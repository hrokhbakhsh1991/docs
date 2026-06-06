import { metricsRegistry } from "../observability/metrics";
import { logger } from "../observability/logger";

export type OutboxShutdownDrainResult = {
  readonly drained: boolean;
  readonly pending: number;
  readonly activeProcessing: number;
};

export class GracefulShutdownOutboxFlushTimeoutError extends Error {
  readonly code = "GRACEFUL_SHUTDOWN_OUTBOX_FLUSH_TIMEOUT";

  constructor(
    readonly pending: number,
    readonly activeProcessing: number
  ) {
    super(
      `GRACEFUL_SHUTDOWN_OUTBOX_FLUSH_TIMEOUT: pending=${pending} activeProcessing=${activeProcessing}`
    );
    this.name = "GracefulShutdownOutboxFlushTimeoutError";
  }
}

export function signalOutboxShutdownFlushTimeout(result: OutboxShutdownDrainResult): void {
  metricsRegistry.increment("graceful_shutdown_outbox_flush_timeout_total");
  logger.warn(
    {
      event: "graceful_shutdown.outbox_flush_timeout",
      pending: result.pending,
      activeProcessing: result.activeProcessing,
      code: "GRACEFUL_SHUTDOWN_OUTBOX_FLUSH_TIMEOUT",
    },
    "graceful shutdown outbox flush deadline exceeded"
  );
}

export function assertOutboxShutdownDrained(result: OutboxShutdownDrainResult): void {
  if (result.drained) {
    return;
  }
  signalOutboxShutdownFlushTimeout(result);
  throw new GracefulShutdownOutboxFlushTimeoutError(result.pending, result.activeProcessing);
}
