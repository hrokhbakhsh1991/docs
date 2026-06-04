import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { ToursService } from "../src/tours/tours.service";

export function createTestToursService(): ToursService {
  return new ToursService(
    new CanonicalTourService(
      new TourStorageDbAdapter(new InMemoryTourRepository()),
      new LegacyCanonicalAdapter(),
    ),
  );
}
