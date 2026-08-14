/**
 * PR14-B — Fail-open Command Bridge telemetry.
 * No audit persistence · no Case history · sink failures never fail HTTP.
 */

export type CaseCommandTelemetryEventName =
  | "command_requested"
  | "auth_denied"
  | "vocabulary_denied"
  | "stale_rejected"
  | "sot_rejected"
  | "provider_unavailable"
  | "reexecute_failed"
  | "intent_invalid"
  | "succeeded";

export type CaseCommandTelemetryEvent = {
  readonly kind: "case_command";
  readonly event: CaseCommandTelemetryEventName;
  readonly tenantId: string;
  readonly caseKey: string;
  readonly command: "reviewReceipt";
  readonly actionToken: string;
  readonly correlationId: string;
  readonly registrationId: string;
  readonly recordedAtMs: number;
  /** PR19 — optional command latency observation (ms). */
  readonly durationMs?: number;
};

export type CaseCommandTelemetrySink = {
  readonly emit: (event: CaseCommandTelemetryEvent) => void | Promise<void>;
};

const FORBIDDEN_TELEMETRY_VOCAB =
  /caseStatus|ownershipHistory|workflowState|CaseOutput|FactSnapshot|prisma|stripe|pi_/i;

export function createInMemoryCaseCommandTelemetrySink(): CaseCommandTelemetrySink & {
  readonly events: CaseCommandTelemetryEvent[];
} {
  const events: CaseCommandTelemetryEvent[] = [];
  return {
    events,
    emit(event) {
      if (FORBIDDEN_TELEMETRY_VOCAB.test(JSON.stringify(event))) {
        return;
      }
      events.push(event);
    },
  };
}

let defaultSink: CaseCommandTelemetrySink | null = null;

export function setCaseCommandTelemetrySink(sink: CaseCommandTelemetrySink | null): void {
  defaultSink = sink;
}

export function getCaseCommandTelemetrySink(): CaseCommandTelemetrySink {
  return (
    defaultSink ?? {
      emit() {
        /* no-op default */
      },
    }
  );
}

export function safeEmitCaseCommandTelemetry(
  sink: CaseCommandTelemetrySink,
  event: CaseCommandTelemetryEvent
): void {
  try {
    if (FORBIDDEN_TELEMETRY_VOCAB.test(JSON.stringify(event))) {
      return;
    }
    void Promise.resolve(sink.emit(event)).catch(() => {
      /* fail-open */
    });
  } catch {
    /* fail-open */
  }
}
