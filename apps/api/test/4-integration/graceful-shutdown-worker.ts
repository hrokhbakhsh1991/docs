/**
 * Subprocess API for graceful-shutdown integration test.
 *
 * Mirrors {@link apps/api/src/main.ts} bootstrap (HTTP listener + outbox relay)
 * with shared {@link runGracefulShutdown} / {@link installGracefulShutdownHandlers} (DEC-085 / SD-G7).
 *
 * Emits `GRACEFUL_SHUTDOWN_READY {"port":N}` on stdout when listening.
 */
import { createServer } from "node:http";

import { assertAuthEnvironmentIntegrity } from "../../src/tenant-kernel/auth-env";
import { createRequestListener } from "../../src/app";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { withRequestLogging } from "../../src/http/request-logging";
import { startOutboxRelayIfEnabled } from "../../src/outbox/start-outbox-relay";
import { installGracefulShutdownHandlers } from "../../src/server/graceful-shutdown";
import { ToursService } from "../../src/tours/tours.service";

function emitHarnessStderr(event: string, code: string): void {
  process.stderr.write(`${JSON.stringify({ event, code })}\n`);
}

assertAuthEnvironmentIntegrity();

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

installGracefulShutdownHandlers({ server, outboxRelay });

server.listen(0, "127.0.0.1", () => {
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    emitHarnessStderr("graceful_shutdown_worker.boot.failed", "NO_LISTEN_ADDRESS");
    process.exit(2);
  }
  process.stdout.write(`GRACEFUL_SHUTDOWN_READY ${JSON.stringify({ port: addr.port })}\n`);
});
