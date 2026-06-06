import { randomUUID } from "node:crypto";

import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import type { TourStorageRepository } from "../src/db/tour.repository";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { ToursService } from "../src/tours/tours.service";

/**
 * Postgres integration tenant id — UUID v4 whose first hex digit is a letter (platform-core RuleContext).
 */
export function integrationTenantId(): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const id = randomUUID();
    if (/^[a-f]/i.test(id)) {
      return id;
    }
  }
  throw new Error("integrationTenantId: could not generate platform-core-compatible UUID");
}

export function createTestToursService(
  store: TourStorageRepository = new InMemoryTourRepository()
): ToursService {
  return new ToursService(
    new CanonicalTourService(new TourStorageDbAdapter(store), new LegacyCanonicalAdapter())
  );
}
