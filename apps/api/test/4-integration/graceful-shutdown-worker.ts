/**
 * Subprocess API for graceful-shutdown integration test.
 *
 * Mirrors {@link apps/api/src/main.ts} bootstrap (HTTP listener + outbox relay)
 * with an explicit SIGTERM shutdown contract the integration spec asserts:
 *   1. Stop accepting new HTTP connections (`server.close`)
 *   2. Stop outbox relay timer and flush pending rows
 *   3. Disconnect Prisma pools
 *   4. Exit 0
 *
 * Emits `GRACEFUL_SHUTDOWN_READY {"port":N}` on stdout when listening.
 */
import { createServer } from "node:http";

import { assertAuthEnvironmentIntegrity } from "../../src/tenant-kernel/auth-env";
import { createRequestListener } from "../../src/app";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { withRequestLogging } from "../../src/http/request-logging";
import { processOutboxRelayOnce } from "../../src/outbox/outbox-relay";
import { startOutboxRelayIfEnabled } from "../../src/outbox/start-outbox-relay";
import { ToursService } from "../../src/tours/tours.service";

assertAuthEnvironmentIntegrity();

const FLUSH_DEADLINE_MS = Number.parseInt(process.env.GRACEFUL_SHUTDOWN_FLUSH_MS ?? "8000", 10);

const canonicalStore = new TourStorageDbAdapter(createTourStorageRepository());
const canonicalTourService = new CanonicalTourService(canonicalStore, new LegacyCanonicalAdapter());
const toursService = new ToursService(canonicalTourService);

const server = createServer(
  withRequestLogging(
    createRequestListener({
      toursService,
    })
  )
);

const outboxRelay = startOutboxRelayIfEnabled();

let shuttingDown = false;

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

async function gracefulShutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  outboxRelay.stop();

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  await flushOutboxRelay();

  await disconnectPrisma();
  process.exit(0);
}

server.listen(0, "127.0.0.1", () => {
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    console.error("graceful-shutdown-worker: no listen address");
    process.exit(2);
  }
  process.stdout.write(`GRACEFUL_SHUTDOWN_READY ${JSON.stringify({ port: addr.port })}\n`);
});

process.on("SIGTERM", () => {
  void gracefulShutdown().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`graceful-shutdown-worker: shutdown failed: ${message}`);
    process.exit(1);
  });
});
