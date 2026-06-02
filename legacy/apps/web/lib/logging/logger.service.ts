/* eslint-disable no-console -- intentional browser structured logger shim */
type LogMeta = Record<string, unknown>;

/**
 * Browser-safe structured logger for wizard submit forensic events.
 * Mirrors API {@link LoggerService} call shape; routes production errors to Sentry when present.
 */
export const LoggerService = {
  info(message: string, meta: LogMeta = {}): void {
    console.info(message, meta);
  },

  error(message: string, meta: LogMeta = {}): void {
    console.error(message, meta);

    const sentry = (
      globalThis as {
        Sentry?: {
          captureMessage?: (msg: string, ctx?: { level?: string; extra?: LogMeta }) => void;
        };
      }
    ).Sentry;
    sentry?.captureMessage?.(message, { level: "error", extra: meta });
  },
};
