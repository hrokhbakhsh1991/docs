import { context, trace } from "@opentelemetry/api";

/** Hex IDs for log correlation (maps to OTLP `trace_id` / `span_id`). */
export type TraceLogFields = {
  trace_id: string;
  span_id: string;
};

/**
 * Reads W3C trace context from the active span for structured logs (Pino / Loki / Datadog log correlation).
 */
export function tryGetActiveTraceLogFields(): TraceLogFields | null {
  const span = trace.getSpan(context.active());
  const sc = span?.spanContext();
  if (!sc || !trace.isSpanContextValid(sc)) {
    return null;
  }
  return {
    trace_id: sc.traceId,
    span_id: sc.spanId
  };
}
