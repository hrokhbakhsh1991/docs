import type { Server } from "node:http";

import { disconnectPrisma } from "../db/prisma";
import { drainHttpRequestLogQueueSync } from "../http/request-logging";
import { flushLogSink, logger } from "../observability/logger";
import { metricsRegistry } from "../observability/metrics";
import { drainOutboxRelayOnShutdown } from "../outbox/outbox-shutdown-drain";
import type { OutboxRelayHandle } from "../outbox/start-outbox-relay";
import { assertOutboxShutdownDrained } from "./graceful-shutdown-outbox-flush";

const FLUSH_DEADLINE_MS = Number.parseInt(process.env.GRACEFUL_SHUTDOWN_FLUSH_MS ?? "8000", 10);
const HTTP_SHUTDOWN_MS = Number.parseInt(process.env.GRACEFUL_SHUTDOWN_HTTP_MS ?? "10000", 10);

export class GracefulShutdownHttpTimeoutError extends Error {
  constructor() {
    super("GRACEFUL_SHUTDOWN_HTTP_TIMEOUT");
    this.name = "GracefulShutdownHttpTimeoutError";
  }
}

export type GracefulShutdownDeps = {
  readonly server: Server;
  readonly outboxRelay: OutboxRelayHandle;
};

let shuttingDown = false;

export function isGracefulShutdownInProgress(): boolean {
  return shuttingDown;
}

/** Test-only — reset shutdown latch between specs. */
export function resetGracefulShutdownStateForTests(): void {
  shuttingDown = false;
}

async function closeHttpServerWithWatchdog(server: Server): Promise<void> {
  if (typeof server.closeIdleConnections === "function") {
    server.closeIdleConnections();
  }

  let timeoutHandle: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
      new Promise<void>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          if (typeof server.closeAllConnections === "function") {
            server.closeAllConnections();
          }
          metricsRegistry.increment("graceful_shutdown_http_force_close_total");
          reject(new GracefulShutdownHttpTimeoutError());
        }, HTTP_SHUTDOWN_MS);
        timeoutHandle.unref?.();
      }),
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Production shutdown contract (P0): stop relay → health 503 → drain HTTP → flush logs → outbox → Prisma.
 * @see docs/phase-5/appendices/graceful-shutdown-http-watchdog.md DEC-085
 */
export async function runGracefulShutdown(deps: GracefulShutdownDeps): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  await deps.outboxRelay.stop();
  await closeHttpServerWithWatchdog(deps.server);

  drainHttpRequestLogQueueSync();
  await flushLogSink();

  if (process.env.DATABASE_URL?.trim()) {
    const drain = await drainOutboxRelayOnShutdown(FLUSH_DEADLINE_MS);
    assertOutboxShutdownDrained(drain);
    await disconnectPrisma();
  }
}

export function installGracefulShutdownHandlers(deps: GracefulShutdownDeps): void {
  const onSignal = () => {
    void runGracefulShutdown(deps)
      .then(() => {
        process.exit(0);
      })
      .catch(() => {
        logger.error(
          { event: "graceful_shutdown.failed", code: "GRACEFUL_SHUTDOWN_FAILED" },
          "graceful shutdown failed"
        );
        process.exit(1);
      });
  };
  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
}
