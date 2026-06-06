import pino from "pino";

import {
  bindLogSinkBackpressureMetrics,
  bindLogSinkErrorHandler,
  createBoundedLogDestination,
  resolveLogSinkFlushTimeoutMs,
} from "./log-sink";
import { metricsRegistry } from "./metrics";

const logDestination = createBoundedLogDestination();
bindLogSinkBackpressureMetrics(logDestination);
bindLogSinkErrorHandler(logDestination);

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: { service: "@apps/api" },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  logDestination
);

export type RequestLogContext = {
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly durationMs: number;
  /** Ingress trace ALS id — omitted when unbound (DEC-048 / TRACE-LOST-01). */
  readonly correlationId?: string;
};

export function logHttpRequest(ctx: RequestLogContext): void {
  const payload: Record<string, unknown> = {
    event: "http.request",
    http: {
      method: ctx.method,
      path: ctx.path,
      statusCode: ctx.statusCode,
    },
    durationMs: ctx.durationMs,
  };
  if (ctx.correlationId !== undefined) {
    payload.correlation_id = ctx.correlationId;
  }
  logger.info(payload, "request completed");
}

/** Best-effort flush before process exit (DEC-063 / FOF-LOG-03). */
export function flushLogSink(): Promise<void> {
  const timeoutMs = resolveLogSinkFlushTimeoutMs();
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      metricsRegistry.increment("log_shutdown_flush_timed_out_total");
      resolve();
    }, timeoutMs);
    timer.unref?.();
    logger.flush(() => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      metricsRegistry.increment("log_shutdown_flush_total");
      resolve();
    });
  });
}
