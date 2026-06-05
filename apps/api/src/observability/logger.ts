import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "@apps/api" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

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
