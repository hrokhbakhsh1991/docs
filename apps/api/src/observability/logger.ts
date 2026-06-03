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
};

export function logHttpRequest(ctx: RequestLogContext): void {
  logger.info(
    {
      event: "http.request",
      http: {
        method: ctx.method,
        path: ctx.path,
        statusCode: ctx.statusCode,
      },
      durationMs: ctx.durationMs,
    },
    "request completed",
  );
}
