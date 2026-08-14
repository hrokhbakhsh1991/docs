/**
 * Production-safe Finance Case observation sink (PR4.5-C).
 * Diagnostics only — never Case status history or workflow state.
 */

import type {
  ShadowExecutionResult,
  ShadowObservationSink,
} from "@app-tour/finance-core/case";

export type FinanceCaseMismatchClass =
  | "none"
  | "provider_degraded"
  | "execution_failed"
  | "incomplete_inspect"
  | "exception_reading"
  | "unclassified";

export type FinanceCaseObservationRecord = {
  readonly executionId: string | null;
  readonly observationId: string;
  readonly caseKey: string | null;
  readonly triggerKind: string;
  readonly outcome: "ok" | "failed" | "skipped";
  readonly assembleDurationMs: number | null;
  readonly interpreterDurationMs: number | null;
  readonly totalDurationMs: number | null;
  readonly shadowDurationMs: number | null;
  readonly degradedProviders: readonly string[];
  readonly mismatchClass: FinanceCaseMismatchClass;
  readonly reading: string | null;
  readonly recordedAtMs: number;
};

export type FinanceCaseObservationEmitter = {
  readonly emit: (record: FinanceCaseObservationRecord) => void | Promise<void>;
};

function classify(result: ShadowExecutionResult): FinanceCaseMismatchClass {
  if (!result.ok) {
    return "execution_failed";
  }
  if (result.executionDiagnostics.degradedProviders.length > 0) {
    return "provider_degraded";
  }
  const reading = result.caseOutput.reading;
  if (reading === "INCOMPLETE_INSPECT") {
    return "incomplete_inspect";
  }
  if (reading === "EXCEPTION") {
    return "exception_reading";
  }
  return "none";
}

/**
 * Build a ShadowObservationSink that forwards structured diagnostics to an emitter.
 * Emitter failures are ignored by runShadowFinanceCase.
 */
export function createFinanceCaseObservationSink(
  emitter: FinanceCaseObservationEmitter
): ShadowObservationSink {
  return {
    async onObservation(result) {
      const record: FinanceCaseObservationRecord = result.ok
        ? {
            executionId: result.executionDiagnostics.executionId,
            observationId: result.shadowDiagnostics.observationId,
            caseKey: result.executionDiagnostics.caseKey,
            triggerKind: result.shadowDiagnostics.triggerKind ?? "unspecified",
            outcome: "ok",
            assembleDurationMs: result.executionDiagnostics.assembleDurationMs,
            interpreterDurationMs: result.executionDiagnostics.interpreterDurationMs,
            totalDurationMs: result.executionDiagnostics.totalDurationMs,
            shadowDurationMs: result.shadowDiagnostics.shadowDurationMs,
            degradedProviders: result.executionDiagnostics.degradedProviders,
            mismatchClass: classify(result),
            reading: result.caseOutput.reading,
            recordedAtMs: Date.now(),
          }
        : {
            executionId: null,
            observationId: result.shadowDiagnostics.observationId,
            caseKey: null,
            triggerKind: result.shadowDiagnostics.triggerKind ?? "unspecified",
            outcome: "failed",
            assembleDurationMs: null,
            interpreterDurationMs: null,
            totalDurationMs: null,
            shadowDurationMs: result.shadowDiagnostics.shadowDurationMs,
            degradedProviders: [],
            mismatchClass: "execution_failed",
            reading: null,
            recordedAtMs: Date.now(),
          };
      await emitter.emit(record);
    },
  };
}

/** In-memory sink for tests / local observability. */
export function createInMemoryFinanceCaseObservationEmitter(): FinanceCaseObservationEmitter & {
  readonly records: FinanceCaseObservationRecord[];
} {
  const records: FinanceCaseObservationRecord[] = [];
  return {
    records,
    emit(record) {
      records.push(record);
    },
  };
}
