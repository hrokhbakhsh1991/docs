/**
 * High-level Denali Case shadow + comparison scheduler (PR4.5-C / PR5-A / PR5-B).
 * Flag / allowlist / sample OFF → immediate no-op (zero SoT reads).
 * Production sink + calibration are observational and fail-open.
 */

import type { FactSnapshot, ShadowObservationSink } from "@app-tour/finance-core/case";

import {
  compareFinanceCaseObservation,
  createInMemoryFinanceCaseComparisonEmitter,
  loadOperationalObservation,
  summarizeOperationalForObservation,
  type FinanceCaseComparisonEmitter,
  type FinanceCaseComparisonObservation,
} from "./comparison/index";
import {
  composeDenaliCaseFactProviders,
  resolveDenaliCaseCapabilityFromEnv,
  type DenaliCaseCapabilityConfig,
} from "./compose-denali-case-providers";
import {
  isFinanceCaseShadowSkipComparisonReads,
  resolveFinanceCaseShadowRollout,
} from "./finance-case-feature-flag";
import {
  buildEnrollmentCaseScope,
  type HostDenaliCaseReadDeps,
  HostDenaliCaseReadSource,
} from "./host-denali-case-read-source";
import {
  invokeFinanceCaseShadow,
  type FinanceCaseShadowSkipped,
  type InvokeFinanceCaseShadowResult,
} from "./invoke-finance-case-shadow";
import type { ProductionObservationSink } from "./observation/production-observation-sink";
import { mapShadowMismatchTaxonomy } from "./shadow/shadow-mismatch-taxonomy";

export type DenaliFinanceCaseShadowTrigger =
  | "post_receipt_submit"
  | "post_receipt_review"
  | "post_payment_mutation"
  | "finance_read"
  | "sampled"
  | "manual";

export type ScheduleDenaliFinanceCaseShadowInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  /** Opaque counterparty id (e.g. booking submittedByUserId). */
  readonly counterpartyId: string;
  readonly trigger: DenaliFinanceCaseShadowTrigger;
  readonly readDeps: Omit<HostDenaliCaseReadDeps, "tenantId">;
  readonly sink?: ShadowObservationSink;
  /** PR5-A comparison observation emitter (optional). */
  readonly comparisonEmitter?: FinanceCaseComparisonEmitter;
  /** PR5-B production calibration sink (optional). */
  readonly productionObservationSink?: ProductionObservationSink;
  readonly providerTimeoutMs?: number;
  readonly enabled?: boolean;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly observationId?: string;
  readonly random?: () => number;
  /**
   * PR11-C — payment capability + recon composition.
   * When omitted, resolved from env (default manual, recon off).
   */
  readonly capability?: DenaliCaseCapabilityConfig;
};

export type DenaliFinanceCaseShadowSkipped = {
  readonly skipped: true;
  readonly reason: "disabled" | "tenant_excluded" | "sampled_out" | "trigger_excluded";
};

export type DenaliFinanceCaseShadowRunResult = {
  readonly skipped: false;
  readonly shadow: InvokeFinanceCaseShadowResult;
  readonly comparison: FinanceCaseComparisonObservation | null;
};

export type RunDenaliFinanceCaseShadowResult =
  | DenaliFinanceCaseShadowSkipped
  | DenaliFinanceCaseShadowRunResult;

function triggerKind(
  trigger: DenaliFinanceCaseShadowTrigger
): "post_mutation" | "sampled" | "manual" | "other" {
  if (trigger === "sampled") {
    return "sampled";
  }
  if (trigger === "manual") {
    return "manual";
  }
  if (trigger === "finance_read") {
    return "other";
  }
  return "post_mutation";
}

async function emitComparisonSafely(
  emitter: FinanceCaseComparisonEmitter | undefined,
  observation: FinanceCaseComparisonObservation
): Promise<void> {
  if (emitter === undefined) {
    return;
  }
  try {
    await emitter.emit(observation);
  } catch {
    /* sink failure swallowed */
  }
}

async function recordProductionSafely(
  sink: ProductionObservationSink | undefined,
  comparison: FinanceCaseComparisonObservation,
  snapshot: FactSnapshot | null
): Promise<void> {
  if (sink === undefined) {
    return;
  }
  try {
    await sink.record({ comparison, snapshot });
  } catch {
    /* production sink failure swallowed */
  }
}

function isSkippedShadowResult(
  shadow: InvokeFinanceCaseShadowResult
): shadow is FinanceCaseShadowSkipped {
  return "skipped" in shadow && shadow.skipped;
}

/**
 * Awaitable shadow + optional comparison — fail-open.
 * Returns skipped without touching repos when disabled / excluded / sampled out.
 */
export async function runDenaliFinanceCaseShadow(
  input: ScheduleDenaliFinanceCaseShadowInput
): Promise<RunDenaliFinanceCaseShadowResult> {
  const env = input.env ?? process.env;
  const rollout = resolveFinanceCaseShadowRollout({
    tenantId: input.tenantId,
    env,
    enabled: input.enabled,
    random: input.random,
    trigger: input.trigger,
  });
  if (!rollout.run) {
    return { skipped: true, reason: rollout.reason };
  }

  const source = new HostDenaliCaseReadSource({
    tenantId: input.tenantId,
    ...input.readDeps,
  });
  const capability =
    input.capability ??
    resolveDenaliCaseCapabilityFromEnv(env, {
      gateway: undefined,
    });
  const providers = composeDenaliCaseFactProviders({ source, capability });
  const scope = buildEnrollmentCaseScope({
    registrationId: input.registrationId,
    counterpartyId: input.counterpartyId,
  });

  const shadow = await invokeFinanceCaseShadow({
    enabled: true,
    providers,
    sink: input.sink,
    request: {
      execution: {
        scope,
        mode: "lookup",
        includeLedger: true,
        includeSignal: true,
        providerTimeoutMs: input.providerTimeoutMs ?? 2_000,
      },
      observation: {
        observationId: input.observationId,
        triggerKind: triggerKind(input.trigger),
        note: input.trigger,
      },
    },
  });

  if (isSkippedShadowResult(shadow)) {
    return { skipped: true, reason: shadow.reason };
  }

  const completedShadow: Exclude<InvokeFinanceCaseShadowResult, FinanceCaseShadowSkipped> =
    shadow;

  const comparisonStarted = Date.now();
  let comparison: FinanceCaseComparisonObservation | null = null;
  const snapshot = completedShadow.snapshot;
  try {
    const skipOpsReads = isFinanceCaseShadowSkipComparisonReads(env);
    const operational = skipOpsReads
      ? null
      : await loadOperationalObservation({
          tenantId: input.tenantId,
          registrationId: input.registrationId,
          readDeps: input.readDeps,
        });

    const shadowOk = completedShadow.ok;
    const caseOutput = shadowOk ? completedShadow.caseOutput : null;
    const degraded = shadowOk ? completedShadow.executionDiagnostics.degradedProviders : [];
    const compared = skipOpsReads
      ? {
          category: "uncomparable" as const,
          interpreter: caseOutput
            ? {
                reading: caseOutput.reading,
                owner: caseOutput.owner,
                lane: caseOutput.lane,
                completenessClass: caseOutput.completenessClass,
                decisionReady: caseOutput.decisionReady,
              }
            : null,
          operational: null,
          notes: ["comparison_reads_skipped_cost_control"] as const,
          taxonomyHints: ["UNCOMPARABLE"] as const,
        }
      : compareFinanceCaseObservation({
          caseOutput,
          operational,
          degradedProviders: degraded,
      shadowFailed: !shadowOk,
        });

    const taxonomyCode = mapShadowMismatchTaxonomy({
      category: compared.category,
      notes: compared.notes,
      taxonomyHints: compared.taxonomyHints,
    });

    const comparisonDurationMs = Date.now() - comparisonStarted;
    comparison = {
      executionId: shadowOk ? completedShadow.executionDiagnostics.executionId : null,
      observationId: completedShadow.shadowDiagnostics.observationId,
      caseKey: shadowOk ? completedShadow.executionDiagnostics.caseKey : scope.caseKey,
      triggerSource: input.trigger,
      category: compared.category,
      taxonomyCode,
      interpreter: compared.interpreter,
      operational: summarizeOperationalForObservation(compared.operational),
      degradedProviders: degraded,
      notes: [...compared.notes],
      latency: {
        executionDurationMs: shadowOk ? completedShadow.executionDiagnostics.totalDurationMs : null,
        assembleDurationMs: shadowOk ? completedShadow.executionDiagnostics.assembleDurationMs : null,
        interpreterDurationMs: shadowOk
          ? completedShadow.executionDiagnostics.interpreterDurationMs
          : null,
        comparisonDurationMs,
        shadowDurationMs: completedShadow.shadowDiagnostics.shadowDurationMs,
      },
      recordedAtMs: Date.now(),
    };
    await emitComparisonSafely(input.comparisonEmitter, comparison);
    await recordProductionSafely(input.productionObservationSink, comparison, snapshot);
  } catch {
    comparison = null;
  }

  return { skipped: false, shadow: completedShadow, comparison };
}

/** Fire-and-forget; never rejects into primary workflow. */
export function scheduleDenaliFinanceCaseShadow(
  input: ScheduleDenaliFinanceCaseShadowInput
): void {
  const rollout = resolveFinanceCaseShadowRollout({
    tenantId: input.tenantId,
    env: input.env,
    enabled: input.enabled,
    random: input.random,
    trigger: input.trigger,
  });
  if (!rollout.run) {
    return;
  }
  void runDenaliFinanceCaseShadow({ ...input, enabled: true }).catch(() => {
    /* fail-open */
  });
}

/** Test / Host helper — builds providers without scheduling (always reads SoT). */
export function createLiveDenaliCaseProvidersForTenant(
  deps: HostDenaliCaseReadDeps,
  capability?: DenaliCaseCapabilityConfig
) {
  const source = new HostDenaliCaseReadSource(deps);
  const resolved = capability ?? resolveDenaliCaseCapabilityFromEnv(process.env);
  return composeDenaliCaseFactProviders({ source, capability: resolved });
}

export { createInMemoryFinanceCaseComparisonEmitter };
