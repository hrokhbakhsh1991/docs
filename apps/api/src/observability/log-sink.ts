import pino from "pino";

import { metricsRegistry } from "./metrics";

type LogDestination = ReturnType<typeof pino.destination>;

export function resolveLogSinkMinLength(): number {
  const parsed = Number.parseInt(process.env.LOG_SINK_MIN_LENGTH ?? "4096", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4096;
}

export function resolveLogSinkMaxLength(): number {
  const parsed = Number.parseInt(process.env.LOG_SINK_MAX_LENGTH ?? "4194304", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4_194_304;
}

export function resolveLogSinkFlushTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.LOG_SINK_FLUSH_TIMEOUT_MS ?? "2000", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2000;
}

export function createBoundedLogDestination(): LogDestination {
  return pino.destination({
    dest: 1,
    sync: false,
    minLength: resolveLogSinkMinLength(),
    maxLength: resolveLogSinkMaxLength(),
    // SCAL-HF-09 — do not spin on EAGAIN; emit error once for metric + swallow handler.
    retryEAGAIN: () => false,
  });
}

export function bindLogSinkBackpressureMetrics(destination: LogDestination): void {
  destination.on("drain", () => {
    metricsRegistry.increment("log_sink_drain_total");
  });
  destination.on("drop", () => {
    metricsRegistry.increment("log_sink_drop_total");
  });
}

/** SCAL-HF-09 — full pipe / broken stdout must not uncaught-crash the worker. */
export function bindLogSinkErrorHandler(destination: LogDestination): void {
  destination.on("error", () => {
    metricsRegistry.increment("log_sink_error_total");
  });
}
