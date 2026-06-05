import type { Server } from "node:http";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { logger } from "../observability/logger";
import { processOutboxRelayOnce } from "../outbox/outbox-relay";
import type { OutboxRelayHandle } from "../outbox/start-outbox-relay";

const FLUSH_DEADLINE_MS = Number.parseInt(process.env.GRACEFUL_SHUTDOWN_FLUSH_MS ?? "8000", 10);

async function flushOutboxRelay(): Promise<void> {
  const deadline = Date.now() + FLUSH_DEADLINE_MS;
  while (Date.now() < deadline) {
    await processOutboxRelayOnce(50);
    const pending = await getPrismaAdmin().outboxEvent.count({
      where: { status: "pending" },
    });
    if (pending === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export type GracefulShutdownDeps = {
  readonly server: Server;
  readonly outboxRelay: OutboxRelayHandle;
};

let shuttingDown = false;

/**
 * Production shutdown contract (P0): stop relay → drain HTTP → flush outbox → disconnect Prisma.
 * @see apps/api/test/4-integration/graceful-shutdown-worker.ts
 */
export async function runGracefulShutdown(deps: GracefulShutdownDeps): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  deps.outboxRelay.stop();

  await new Promise<void>((resolve, reject) => {
    deps.server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  if (process.env.DATABASE_URL?.trim()) {
    await flushOutboxRelay();
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
