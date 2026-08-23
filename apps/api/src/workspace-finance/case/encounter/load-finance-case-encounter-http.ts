/**
 * Host port implementation for GET Case Encounter (PR12-B / PR12-C / PR13-A).
 * Authz → production decision → budgeted load → presentation. Telemetry fail-open.
 */

import type { FinanceCaseEncounterLoadResult } from "@app-tour/finance-http-contracts";
import type { FinanceRouteDeps } from "@app-tour/finance-http";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { resolveFinanceServiceForTenant } from "../../../boot/lazy-finance-service";
import type { FinanceService } from "../../finance.service";
import { HostFinanceAccessAdapter } from "../../infrastructure/host-finance-access.adapter";
import { resolveDenaliCaseCapabilityFromEnv } from "../compose-denali-case-providers";
import {
  authorizeCaseEncounterView,
  CaseEncounterViewAuthzDeniedError,
  type CaseEncounterViewAuthorizer,
} from "./authorize-case-encounter-view";
import { buildLiveDenaliCaseReadDepsForTenant } from "./build-live-denali-case-read-deps";
import type { CaseEncounterPresentationResponse } from "./case-encounter-presentation";
import { deriveEncounterSurfaceState } from "./derive-encounter-surface-state";
import {
  EncounterExecutionTimeoutError,
  resolveEncounterExecutionTimeoutMs,
  resolveEncounterGatewayTimeoutMs,
  withEncounterTimeout,
} from "./encounter-execution-timeout";
import {
  resolveEncounterProductionDecision,
  type EncounterProductionDecisionReason,
} from "./encounter-production-decision";
import {
  getEncounterTelemetrySink,
  safeEmitEncounterTelemetry,
  type EncounterOperatorFeedbackEvent,
  type EncounterTelemetrySink,
} from "./encounter-telemetry";
import {
  listProviderDegradationTelemetryEvents,
  type EncounterProviderName,
} from "./provider-degradation-telemetry";
import {
  isFinanceCaseEncounterEnabled,
  resolveFinanceCaseEncounterRolloutMode,
  type FinanceCaseEncounterRolloutMode,
} from "./finance-case-encounter-rollout";
import {
  CaseEncounterNotFoundError,
  loadDenaliCaseEncounterPresentation,
  type LoadDenaliCaseEncounterPresentationInput,
} from "./load-denali-case-encounter-presentation";
import { assertPresentationBoundary } from "./to-case-encounter-presentation";
import { withEncounterGatewayTimeout } from "./timeout-payment-gateway";
import { deriveFinanceCaseCommandCapability } from "@app-tour/finance-http-contracts";
import { getFinanceWorkspaceCapabilities } from "../../workspace-finance-capabilities.generated";
import { resolveFinanceWorkspaceTypeForTenant } from "../../resolve-finance-workspace-type-for-tenant";

export type LoadFinanceCaseEncounterHttpInput = {
  readonly auth: TenantAuthContext;
  readonly registrationId: string;
  readonly counterpartyId: string;
  readonly deps: FinanceRouteDeps;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly random?: () => number;
  readonly telemetry?: EncounterTelemetrySink;
  readonly now?: () => number;
  /** Test seam — defaults to HostFinanceAccessAdapter. */
  readonly authorization?: CaseEncounterViewAuthorizer;
  /** Test seam — defaults to resolveFinanceServiceForTenant. */
  readonly warmFinanceService?: () => Promise<void>;
  /** Test seam — defaults to tenant finance workspace resolution. */
  readonly resolveWorkspaceType?: (tenantId: string) => Promise<string>;
  /** Test seam — defaults to the live workspace presentation loader. */
  readonly loadPresentation?: (
    input: LoadDenaliCaseEncounterPresentationInput
  ) => Promise<CaseEncounterPresentationResponse>;
  /** Test seam — override execution timeout ms. */
  readonly executionTimeoutMs?: number;
};

function strategySampleDecision(
  reason: EncounterProductionDecisionReason
): "run" | "disabled" | "tenant_excluded" | "sampled_out" {
  switch (reason) {
    case "enabled":
      return "run";
    case "tenant_not_allowed":
      return "tenant_excluded";
    case "sample_skipped":
      return "sampled_out";
    case "health_hold":
    case "emergency_disabled":
      return "disabled";
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

/**
 * Compose Host Encounter load result for finance-http.
 * Never returns CaseOutput / FactSnapshot / gateway identifiers.
 */
export async function loadFinanceCaseEncounterHttp(
  input: LoadFinanceCaseEncounterHttpInput
): Promise<FinanceCaseEncounterLoadResult> {
  const env = input.env ?? process.env;
  const now = input.now ?? Date.now;
  const started = now();
  const telemetry = input.telemetry ?? getEncounterTelemetrySink();
  const authorization = input.authorization ?? new HostFinanceAccessAdapter();
  const loadPresentation = input.loadPresentation ?? loadDenaliCaseEncounterPresentation;
  const resolveWorkspaceType = input.resolveWorkspaceType ?? resolveFinanceWorkspaceTypeForTenant;
  const rolloutMode: FinanceCaseEncounterRolloutMode = resolveFinanceCaseEncounterRolloutMode(env);

  const emitFeedback = (
    feedback: EncounterOperatorFeedbackEvent,
    decisionReason?: EncounterProductionDecisionReason | "authz_denied" | "not_evaluated"
  ): void => {
    safeEmitEncounterTelemetry(telemetry, {
      kind: "operator_feedback",
      tenantId: input.auth.tenantId,
      registrationId: input.registrationId,
      feedback,
      decisionReason,
      recordedAtMs: now(),
    });
  };

  const emitHttp = (
    outcome: Extract<
      Parameters<typeof safeEmitEncounterTelemetry>[1],
      { kind: "http_request" }
    >["outcome"],
    extras: {
      readonly featureEnabled: boolean;
      readonly sampleDecision: "run" | "disabled" | "tenant_excluded" | "sampled_out";
      readonly rolloutMode: FinanceCaseEncounterRolloutMode;
      readonly decisionReason: EncounterProductionDecisionReason | "authz_denied" | "not_evaluated";
      readonly executionSucceeded?: boolean;
      readonly providerDegraded?: boolean;
      readonly incompleteSnapshot?: boolean;
      readonly timedOut?: boolean;
    }
  ): void => {
    safeEmitEncounterTelemetry(telemetry, {
      kind: "http_request",
      tenantId: input.auth.tenantId,
      registrationId: input.registrationId,
      outcome,
      durationMs: Math.max(0, now() - started),
      recordedAtMs: now(),
      ...extras,
    });
  };

  try {
    authorizeCaseEncounterView(authorization, input.auth as never);
  } catch (err) {
    if (err instanceof CaseEncounterViewAuthzDeniedError) {
      const enabled = isFinanceCaseEncounterEnabled(env);
      emitFeedback("authz_denied", "authz_denied");
      emitHttp("authz_denied", {
        featureEnabled: enabled,
        sampleDecision: enabled ? "run" : "disabled",
        rolloutMode,
        decisionReason: "authz_denied",
      });
      return {
        status: 403,
        error: {
          code: "CASE_ENCOUNTER_VIEW_AUTHZ_DENIED",
          message: "Operator access required",
        },
      };
    }
    throw err;
  }

  const decision = resolveEncounterProductionDecision({
    tenantId: input.auth.tenantId,
    env,
    random: input.random,
  });

  if (!decision.run) {
    emitHttp("disabled", {
      featureEnabled: false,
      sampleDecision: strategySampleDecision(decision.reason),
      rolloutMode: decision.mode,
      decisionReason: decision.reason,
    });
    return {
      status: 503,
      error: {
        code: "CASE_ENCOUNTER_DISABLED",
        message: `Case Encounter is not enabled (${decision.reason})`,
      },
    };
  }

  // Explicit presentation injection is a host test seam; production uses the
  // live workspace Case stack and must pass the tenant capability gate first.
  if (input.loadPresentation === undefined) {
    let workspaceType: string;
    try {
      workspaceType = await resolveWorkspaceType(input.auth.tenantId);
    } catch {
      return {
        status: 503,
        error: {
          code: "CASE_ENCOUNTER_UNAVAILABLE",
          message: "Case Encounter temporarily unavailable",
        },
      };
    }
    if (getFinanceWorkspaceCapabilities(workspaceType)?.caseMeaning !== true) {
      return {
        status: 503,
        error: {
          code: "CASE_ENCOUNTER_UNAVAILABLE",
          message: "Case Encounter temporarily unavailable",
        },
      };
    }
  }

  // Warm FinanceService only when Encounter will execute — disable must not gate mutations.
  if (input.warmFinanceService !== undefined) {
    await input.warmFinanceService();
  } else {
    await resolveFinanceServiceForTenant(
      input.auth.tenantId,
      input.deps.financeService as FinanceService | undefined
    );
  }

  const execStarted = now();
  const executionTimeoutMs = input.executionTimeoutMs ?? resolveEncounterExecutionTimeoutMs(env);
  const gatewayTimeoutMs = resolveEncounterGatewayTimeoutMs(env);

  try {
    const runLoad = async (): Promise<CaseEncounterPresentationResponse> => {
      if (input.loadPresentation !== undefined) {
        return loadPresentation({
          auth: input.auth as never,
          authorization,
          registrationId: input.registrationId,
          counterpartyId: input.counterpartyId,
          readDeps: {
            bookings: {
              async getById() {
                return null;
              },
            },
            finance: {} as never,
            obligation: {} as never,
          },
          env,
        });
      }

      const readDeps = await buildLiveDenaliCaseReadDepsForTenant(input.auth.tenantId);
      const baseCapability = resolveDenaliCaseCapabilityFromEnv(env);
      const gateway =
        baseCapability.gateway !== undefined
          ? withEncounterGatewayTimeout(baseCapability.gateway, {
              timeoutMs: gatewayTimeoutMs,
              now,
              onLatency: ({ latencyMs, timedOut }) => {
                safeEmitEncounterTelemetry(telemetry, {
                  kind: "provider_latency",
                  tenantId: input.auth.tenantId,
                  registrationId: input.registrationId,
                  provider: "payment_gateway",
                  latencyMs,
                  timedOut,
                  recordedAtMs: now(),
                });
              },
            })
          : undefined;
      const capability = {
        ...baseCapability,
        gateway,
      };
      return loadPresentation({
        auth: input.auth as never,
        authorization,
        registrationId: input.registrationId,
        counterpartyId: input.counterpartyId,
        readDeps,
        capability,
        env,
      });
    };

    const body = await withEncounterTimeout(runLoad(), executionTimeoutMs, {
      label: "encounter_execution",
    });
    assertPresentationBoundary(body.encounter);
    const surfaceState = deriveEncounterSurfaceState(body.encounter);

    const durationMs = Math.max(0, now() - execStarted);
    safeEmitEncounterTelemetry(telemetry, {
      kind: "provider_latency",
      tenantId: input.auth.tenantId,
      registrationId: input.registrationId,
      provider: "encounter_total",
      latencyMs: durationMs,
      timedOut: false,
      recordedAtMs: now(),
    });

    const incompleteSnapshot = surfaceState === "incomplete";
    const providerDegraded = surfaceState === "degraded";

    safeEmitEncounterTelemetry(telemetry, {
      kind: "execution",
      tenantId: input.auth.tenantId,
      registrationId: input.registrationId,
      executionId: body.executionId,
      success: true,
      durationMs,
      providerDegraded,
      incompleteSnapshot,
      timedOut: false,
      recordedAtMs: now(),
    });

    // PR15-H — observation-only: track optional ledger/signal degradation without UI severity.
    if (body.providerObservation !== undefined) {
      const providers = body.providerObservation.providers as Partial<
        Record<
          EncounterProviderName,
          { invoked: boolean; ok: boolean; degraded: boolean; failureReason?: string }
        >
      >;
      for (const event of listProviderDegradationTelemetryEvents({
        tenantId: input.auth.tenantId,
        registrationId: input.registrationId,
        recordedAtMs: now(),
        providers,
      })) {
        safeEmitEncounterTelemetry(telemetry, event);
      }
    }

    emitFeedback("encounter_viewed", decision.reason);
    if (surfaceState === "degraded") {
      emitFeedback("degraded_facts", decision.reason);
    }
    if (surfaceState === "incomplete") {
      emitFeedback("incomplete_coverage", decision.reason);
    }

    emitHttp("ok", {
      featureEnabled: true,
      sampleDecision: "run",
      rolloutMode: decision.mode,
      decisionReason: decision.reason,
      executionSucceeded: true,
      providerDegraded,
      incompleteSnapshot,
    });

    return {
      status: 200,
      body: {
        encounter: body.encounter,
        executionId: body.executionId,
        surfaceState,
        ...(body.meaningFingerprint !== undefined
          ? { meaningFingerprint: body.meaningFingerprint }
          : {}),
        commandCapability: deriveFinanceCaseCommandCapability(body.encounter.allow),
      },
    };
  } catch (err) {
    if (err instanceof CaseEncounterViewAuthzDeniedError) {
      emitFeedback("authz_denied", "authz_denied");
      emitHttp("authz_denied", {
        featureEnabled: true,
        sampleDecision: "run",
        rolloutMode: decision.mode,
        decisionReason: "authz_denied",
      });
      return {
        status: 403,
        error: {
          code: "CASE_ENCOUNTER_VIEW_AUTHZ_DENIED",
          message: "Operator access required",
        },
      };
    }
    if (err instanceof CaseEncounterNotFoundError) {
      emitHttp("not_found", {
        featureEnabled: true,
        sampleDecision: "run",
        rolloutMode: decision.mode,
        decisionReason: decision.reason,
      });
      return {
        status: 404,
        error: {
          code: "CASE_ENCOUNTER_NOT_FOUND",
          message: "Registration not found",
        },
      };
    }

    const timedOut =
      err instanceof EncounterExecutionTimeoutError ||
      (err instanceof Error && /CASE_ENCOUNTER_TIMEOUT/i.test(err.message));
    const durationMs = Math.max(0, now() - execStarted);

    safeEmitEncounterTelemetry(telemetry, {
      kind: "provider_latency",
      tenantId: input.auth.tenantId,
      registrationId: input.registrationId,
      provider: "encounter_total",
      latencyMs: durationMs,
      timedOut,
      recordedAtMs: now(),
    });

    safeEmitEncounterTelemetry(telemetry, {
      kind: "execution",
      tenantId: input.auth.tenantId,
      registrationId: input.registrationId,
      executionId: null,
      success: false,
      durationMs,
      providerDegraded: timedOut,
      incompleteSnapshot: false,
      timedOut,
      recordedAtMs: now(),
    });

    if (timedOut) {
      emitFeedback("timeout", decision.reason);
      emitHttp("timed_out", {
        featureEnabled: true,
        sampleDecision: "run",
        rolloutMode: decision.mode,
        decisionReason: decision.reason,
        executionSucceeded: false,
        timedOut: true,
      });
      return {
        status: 503,
        error: {
          code: "CASE_ENCOUNTER_UNAVAILABLE",
          message: "Case Encounter timed out",
        },
      };
    }

    const message = err instanceof Error ? err.message : "unavailable";
    const projectionFailed = /PRESENTATION_BOUNDARY|projection/i.test(message);
    emitFeedback("encounter_unavailable", decision.reason);
    emitHttp(projectionFailed ? "projection_failed" : "unavailable", {
      featureEnabled: true,
      sampleDecision: "run",
      rolloutMode: decision.mode,
      decisionReason: decision.reason,
      executionSucceeded: false,
    });

    return {
      status: 503,
      error: {
        code: "CASE_ENCOUNTER_UNAVAILABLE",
        message: "Case Encounter temporarily unavailable",
      },
    };
  }
}
