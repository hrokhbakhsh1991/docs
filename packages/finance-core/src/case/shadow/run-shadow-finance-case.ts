/**
 * Internal shadow execution foundation (PR4.5-A).
 *
 * Observes executeFinanceCase without owning workflow meaning.
 * Failures are isolated — never thrown to the caller.
 */

import { randomUUID } from "node:crypto";

import type { CaseFactAssemblerProviders } from "../assemble/assemble-case-fact-snapshot";
import {
  executeFinanceCase,
  type ExecuteFinanceCaseResult,
} from "../execute/execute-finance-case";
import type { CaseExecutionDiagnostics } from "../execute/execution-types";
import type { CaseOutput } from "../output/case-output";
import type { FactSnapshot } from "../snapshot/fact-snapshot";
import type {
  ShadowDiagnostics,
  ShadowExecutionRequest,
} from "./shadow-types";

export type ShadowExecutionOk = {
  readonly ok: true;
  readonly caseOutput: CaseOutput;
  readonly snapshot: FactSnapshot;
  readonly executionDiagnostics: CaseExecutionDiagnostics;
  readonly shadowDiagnostics: ShadowDiagnostics;
};

export type ShadowExecutionFailed = {
  readonly ok: false;
  readonly caseOutput: null;
  readonly snapshot: null;
  readonly executionDiagnostics: null;
  readonly shadowDiagnostics: ShadowDiagnostics;
};

export type ShadowExecutionResult = ShadowExecutionOk | ShadowExecutionFailed;

/** Optional telemetry sink — failures must not fail the shadow run. */
export type ShadowObservationSink = {
  readonly onObservation?: (result: ShadowExecutionResult) => void | Promise<void>;
};

function buildShadowDiagnostics(input: {
  readonly observationId: string;
  readonly triggerKind: ShadowDiagnostics["triggerKind"];
  readonly startedAtMs: number;
  readonly outcome: "ok" | "failed";
  readonly failureMessage?: string;
  readonly sinkErrorIgnored?: boolean;
}): ShadowDiagnostics {
  const completedAtMs = Date.now();
  return {
    observationId: input.observationId,
    triggerKind: input.triggerKind,
    shadowStartedAtMs: input.startedAtMs,
    shadowCompletedAtMs: completedAtMs,
    shadowDurationMs: completedAtMs - input.startedAtMs,
    outcome: input.outcome,
    ...(input.failureMessage !== undefined
      ? { failureMessage: input.failureMessage }
      : {}),
    ...(input.sinkErrorIgnored === true ? { sinkErrorIgnored: true } : {}),
  };
}

async function notifySink(
  sink: ShadowObservationSink | undefined,
  result: ShadowExecutionResult
): Promise<boolean> {
  if (sink?.onObservation === undefined) {
    return false;
  }
  try {
    await sink.onObservation(result);
    return false;
  } catch {
    return true;
  }
}

/**
 * Run Case execution in observational mode.
 * Never throws for execution, interpreter, or sink failures.
 */
export async function runShadowFinanceCase(
  providers: CaseFactAssemblerProviders,
  request: ShadowExecutionRequest,
  sink?: ShadowObservationSink
): Promise<ShadowExecutionResult> {
  const startedAtMs = Date.now();
  const observationId = request.observation?.observationId ?? randomUUID();
  const triggerKind = request.observation?.triggerKind ?? "unspecified";

  let result: ShadowExecutionResult;
  try {
    const executed: ExecuteFinanceCaseResult = await executeFinanceCase(
      providers,
      request.execution
    );
    result = {
      ok: true,
      caseOutput: executed.caseOutput,
      snapshot: executed.snapshot,
      executionDiagnostics: executed.diagnostics,
      shadowDiagnostics: buildShadowDiagnostics({
        observationId,
        triggerKind,
        startedAtMs,
        outcome: "ok",
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "shadow_execution_failed";
    result = {
      ok: false,
      caseOutput: null,
      snapshot: null,
      executionDiagnostics: null,
      shadowDiagnostics: buildShadowDiagnostics({
        observationId,
        triggerKind,
        startedAtMs,
        outcome: "failed",
        failureMessage: message,
      }),
    };
  }

  const sinkErrorIgnored = await notifySink(sink, result);
  if (sinkErrorIgnored && result.ok) {
    return {
      ...result,
      shadowDiagnostics: {
        ...result.shadowDiagnostics,
        sinkErrorIgnored: true,
      },
    };
  }
  if (sinkErrorIgnored && !result.ok) {
    return {
      ...result,
      shadowDiagnostics: {
        ...result.shadowDiagnostics,
        sinkErrorIgnored: true,
      },
    };
  }
  return result;
}
