import { createServer } from "node:http";

import { assertAuthEnvironmentIntegrity } from "./tenant-kernel/auth-env";
import { createRequestListener } from "./app";

assertAuthEnvironmentIntegrity();
import { CanonicalTourService } from "./canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "./canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "./db/tour-storage.adapter";
import { createTourStorageRepository } from "./storage/create-tour-storage";
import { withRequestLogging } from "./http/request-logging";
import { logger } from "./observability/logger";
import { ToursService } from "./tours/tours.service";

const port = Number(process.env.PORT ?? 3001);
const canonicalStore = new TourStorageDbAdapter(createTourStorageRepository());
const canonicalTourService = new CanonicalTourService(canonicalStore, new LegacyCanonicalAdapter());
const toursService = new ToursService(canonicalTourService);

const server = createServer(
  withRequestLogging(
    createRequestListener({
      toursService,
    }),
  ),
);

server.listen(port, () => {
  logger.info({ event: "server.start", port }, "@apps/api listening");
});
