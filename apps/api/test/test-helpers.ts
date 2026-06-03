import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { InMemoryTourRepository } from "../src/db/in-memory-tour.repository";
import { ToursService } from "../src/tours/tours.service";

export function createTestToursService(): ToursService {
  return new ToursService(
    new CanonicalTourService(new InMemoryTourRepository(), new LegacyCanonicalAdapter()),
  );
}
