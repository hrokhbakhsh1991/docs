/**
 * Vendor-neutral production telemetry emitter (PR12-C).
 * Adapters (Datadog / logs / OTel) implement this without touching Case contracts.
 */

import {
  assertEncounterTelemetryHasNoBusinessState,
  type EncounterTelemetrySink,
} from "./encounter-telemetry";

/**
 * Production emitter channels — Host wiring chooses backends.
 * No vendor imports in this module.
 */
export type EncounterProductionEmitter = {
  readonly emitLog?: (record: Readonly<Record<string, unknown>>) => void | Promise<void>;
  readonly emitMetric?: (record: {
    readonly name: string;
    readonly value: number;
    readonly tags: Readonly<Record<string, string>>;
  }) => void | Promise<void>;
  readonly emitEvent?: (record: Readonly<Record<string, unknown>>) => void | Promise<void>;
};

export type CreateEncounterProductionTelemetrySinkOptions = {
  readonly emitter: EncounterProductionEmitter;
  /** Optional secondary sink (tests / in-memory). */
  readonly forward?: EncounterTelemetrySink;
};

function safeCall(fn: () => void | Promise<void>): void {
  try {
    const result = fn();
    if (result !== undefined && typeof (result as Promise<void>).then === "function") {
      void (result as Promise<void>).catch(() => {
        /* fail-open */
      });
    }
  } catch {
    /* fail-open */
  }
}

/**
 * Bridge EncounterTelemetrySink → production emitter (+ optional forward sink).
 * Emitter failures never propagate.
 */
export function createEncounterProductionTelemetrySink(
  options: CreateEncounterProductionTelemetrySinkOptions
): EncounterTelemetrySink {
  const { emitter, forward } = options;
  return {
    emit(event) {
      assertEncounterTelemetryHasNoBusinessState(event);
      if (forward !== undefined) {
        safeCall(() => forward.emit(event));
      }

      const baseTags: Record<string, string> = {
        kind: event.kind,
        tenantId: event.tenantId,
      };

      if (event.kind === "http_request") {
        safeCall(() =>
          emitter.emitMetric?.({
            name: "finance.case.encounter.http.duration_ms",
            value: event.durationMs,
            tags: { ...baseTags, outcome: event.outcome, mode: event.rolloutMode },
          })
        );
        safeCall(() =>
          emitter.emitEvent?.({
            channel: "finance.case.encounter.http",
            outcome: event.outcome,
            durationMs: event.durationMs,
            rolloutMode: event.rolloutMode,
            sampleDecision: event.sampleDecision,
            timedOut: event.timedOut === true,
            registrationId: event.registrationId,
            tenantId: event.tenantId,
          })
        );
        safeCall(() =>
          emitter.emitLog?.({
            msg: "finance_case_encounter_http",
            outcome: event.outcome,
            durationMs: event.durationMs,
            rolloutMode: event.rolloutMode,
            tenantId: event.tenantId,
          })
        );
        return;
      }

      if (event.kind === "provider_latency") {
        safeCall(() =>
          emitter.emitMetric?.({
            name: "finance.case.encounter.provider.latency_ms",
            value: event.latencyMs,
            tags: {
              ...baseTags,
              provider: event.provider,
              timedOut: event.timedOut ? "1" : "0",
            },
          })
        );
        return;
      }

      if (event.kind === "operator_feedback") {
        safeCall(() =>
          emitter.emitEvent?.({
            channel: "finance.case.encounter.operator_feedback",
            feedback: event.feedback,
            decisionReason: event.decisionReason,
            tenantId: event.tenantId,
            registrationId: event.registrationId,
          })
        );
        safeCall(() =>
          emitter.emitMetric?.({
            name: "finance.case.encounter.operator_feedback",
            value: 1,
            tags: { ...baseTags, feedback: event.feedback },
          })
        );
        return;
      }

      if (event.kind === "provider_degradation") {
        safeCall(() =>
          emitter.emitMetric?.({
            name: "finance.case.encounter.provider.degradation",
            value: 1,
            tags: {
              ...baseTags,
              provider: event.provider,
              failureReason: event.failureReason,
              optional: event.optional ? "1" : "0",
            },
          })
        );
        safeCall(() =>
          emitter.emitEvent?.({
            channel: "finance.case.encounter.provider_degradation",
            provider: event.provider,
            failureReason: event.failureReason,
            optional: event.optional,
            latencyMs: event.latencyMs,
            tenantId: event.tenantId,
            registrationId: event.registrationId,
          })
        );
        return;
      }

      safeCall(() =>
        emitter.emitMetric?.({
          name: "finance.case.encounter.execution.duration_ms",
          value: event.durationMs,
          tags: {
            ...baseTags,
            success: event.success ? "1" : "0",
            timedOut: event.timedOut ? "1" : "0",
          },
        })
      );
      safeCall(() =>
        emitter.emitEvent?.({
          channel: "finance.case.encounter.execution",
          success: event.success,
          durationMs: event.durationMs,
          timedOut: event.timedOut,
          providerDegraded: event.providerDegraded,
          incompleteSnapshot: event.incompleteSnapshot,
          executionId: event.executionId,
          tenantId: event.tenantId,
          registrationId: event.registrationId,
        })
      );
    },
  };
}
