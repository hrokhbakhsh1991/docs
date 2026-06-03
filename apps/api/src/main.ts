import { createServer } from "node:http";

import { createRequestListener } from "./app";
import { CanonicalTourService } from "./canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "./canonical/legacy-canonical-adapter";
import { InMemoryTourRepository } from "./db/in-memory-tour.repository";
import { withRequestLogging } from "./http/request-logging";
import { logger } from "./observability/logger";
import { ToursService } from "./tours/tours.service";

const port = Number(process.env.PORT ?? 3001);
const canonicalStore = new InMemoryTourRepository();
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
