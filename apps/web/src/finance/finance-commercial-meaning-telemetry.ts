/**
 * PR17-C — Fail-open Commercial Meaning operator feedback telemetry.
 * Never throws; never mutates flags or SoTs.
 */

export type FinanceCommercialMeaningTelemetryEvent =
  | {
      readonly name: "meaning_opened";
      readonly registrationId: string;
    }
  | {
      readonly name: "meaning_viewed";
      readonly registrationId: string;
      readonly executionId: string;
      readonly surfaceState: "normal" | "degraded" | "incomplete";
      readonly latencyMs?: number;
    }
  | {
      readonly name: "meaning_unavailable";
      readonly registrationId: string;
      readonly reason: string;
    }
  | {
      readonly name: "meaning_timeout";
      readonly registrationId: string;
    }
  | {
      readonly name: "meaning_degraded";
      readonly registrationId: string;
      readonly executionId: string;
    }
  | {
      readonly name: "meaning_incomplete";
      readonly registrationId: string;
      readonly executionId: string;
    }
  | {
      readonly name: "operator_returned_to_operational_view";
      readonly registrationId: string | null;
    };

export type FinanceCommercialMeaningTelemetrySink = {
  readonly emit: (event: FinanceCommercialMeaningTelemetryEvent) => void;
};

const defaultSink: FinanceCommercialMeaningTelemetrySink = {
  emit(event) {
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[finance-commercial-meaning]", event.name, {
        registrationId: "registrationId" in event ? event.registrationId : undefined,
        executionId: "executionId" in event ? event.executionId : undefined,
        surfaceState: "surfaceState" in event ? event.surfaceState : undefined,
        reason: "reason" in event ? event.reason : undefined,
      });
    }
  },
};

let activeSink: FinanceCommercialMeaningTelemetrySink = defaultSink;

/** Test / Host override — never required for production correctness. */
export function setFinanceCommercialMeaningTelemetrySink(
  sink: FinanceCommercialMeaningTelemetrySink | null
): void {
  activeSink = sink ?? defaultSink;
}

/**
 * Emit a Commercial Meaning observation. Fail-open: sink errors are swallowed.
 */
export function emitFinanceCommercialMeaningTelemetry(
  event: FinanceCommercialMeaningTelemetryEvent
): void {
  try {
    activeSink.emit(event);
  } catch {
    /* fail-open */
  }
}
