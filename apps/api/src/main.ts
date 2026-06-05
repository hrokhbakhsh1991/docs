import { createServer } from "node:http";

import { assertProductionDatabaseIntegrity } from "./db/assert-production-database-integrity";
import { assertAuthEnvironmentIntegrity } from "./tenant-kernel/auth-env";
import { assertProductionRuntimeIntegrity } from "./server/production-runtime-env";
import { createRequestListener } from "./app";
import { CanonicalTourService } from "./canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "./canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "./db/tour-storage.adapter";
import { createTourStorageRepository } from "./storage/create-tour-storage";
import { withRequestLogging } from "./http/request-logging";
import { logger } from "./observability/logger";
import { startOutboxRelayIfEnabled } from "./outbox/start-outbox-relay";
import { installGracefulShutdownHandlers } from "./server/graceful-shutdown";
import { ToursService } from "./tours/tours.service";

async function bootstrap(): Promise<void> {
  assertAuthEnvironmentIntegrity();
  assertProductionRuntimeIntegrity();
  await assertProductionDatabaseIntegrity();

  const port = Number(process.env.PORT ?? 3001);
  const canonicalStore = new TourStorageDbAdapter(createTourStorageRepository());
  const canonicalTourService = new CanonicalTourService(
    canonicalStore,
    new LegacyCanonicalAdapter()
  );
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

  server.listen(port, () => {
    logger.info({ event: "server.start", port }, "@apps/api listening");
  });
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ event: "server.boot.failed", error: message }, "boot failed");
  process.exit(1);
});
