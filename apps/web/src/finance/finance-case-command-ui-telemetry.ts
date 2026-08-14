/**
 * PR19 — Fail-open Command UI / classic review client observation telemetry.
 */

export type FinanceCaseCommandUiTelemetryEvent =
  | {
      readonly name: "command_discovered";
      readonly registrationId: string;
      readonly tokenCount: number;
    }
  | {
      readonly name: "command_ui_opened";
      readonly registrationId: string;
    }
  | {
      readonly name: "command_confirmation_shown";
      readonly registrationId: string;
      readonly token: string;
    }
  | {
      readonly name: "command_cancelled";
      readonly registrationId: string;
      readonly phase: string;
    }
  | {
      readonly name: "command_submitted";
      readonly registrationId: string;
      readonly ok: boolean;
      readonly decision?: "approve" | "reject";
      readonly failureClass?: string;
      readonly latencyMs?: number;
      readonly meaningOpenToSubmitMs?: number;
    }
  | {
      readonly name: "command_retry";
      readonly registrationId: string;
    }
  | {
      readonly name: "meaning_refreshed_after_command";
      readonly registrationId: string;
      readonly submitToRefreshMs?: number;
    }
  | {
      readonly name: "classic_review_submitted";
      readonly receiptId: string;
      readonly decision: "approve" | "reject";
      readonly ok: boolean;
    };

export type FinanceCaseCommandUiTelemetrySink = {
  readonly emit: (event: FinanceCaseCommandUiTelemetryEvent) => void;
};

const defaultSink: FinanceCaseCommandUiTelemetrySink = {
  emit(event) {
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[finance-case-command-ui]", event.name, event);
    }
  },
};

let activeSink: FinanceCaseCommandUiTelemetrySink = defaultSink;

export function setFinanceCaseCommandUiTelemetrySink(
  sink: FinanceCaseCommandUiTelemetrySink | null
): void {
  activeSink = sink ?? defaultSink;
}

export function emitFinanceCaseCommandUiTelemetry(
  event: FinanceCaseCommandUiTelemetryEvent
): void {
  try {
    activeSink.emit(event);
  } catch {
    /* fail-open */
  }
}
