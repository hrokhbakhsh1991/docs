import type { TourStorageRepository as DbTourStorageRepository } from "../db/tour.repository";
import type {
  Tour,
  TourStorageRepository as StorageTourStorageRepository,
} from "../storage/tour-storage.interface";

type StorageLayerTourRepo = StorageTourStorageRepository & {
  createTour(data: { tenantId: string; canonical: Tour["canonical"] }): Promise<Tour>;
  updateIfRowVersion(input: {
    tenantId: string;
    id: string;
    canonical: Tour["canonical"];
    expectedRowVersion: number;
  }): Promise<Tour>;
};

function isStorageLayerTourRepo(
  store: DbTourStorageRepository | StorageTourStorageRepository,
): store is StorageLayerTourRepo {
  return typeof (store as StorageTourStorageRepository).listByTenant === "function";
}

/**
 * Shared host tour-store resolution for product HTTP hosts (Denali + Urban).
 * Accepts opaque deps.tourStore — product route-deps types stay behind the generated façade.
 */
export async function resolveProductTourStore(deps: {
  readonly tourStore?: unknown;
}): Promise<DbTourStorageRepository> {
  const [{ TourStorageDbAdapter }, { createTourStorageRepository }] = await Promise.all([
    import("../db/tour-storage.adapter"),
    import("../storage/create-tour-storage"),
  ]);
  if (deps.tourStore !== undefined) {
    const tourStore = deps.tourStore as DbTourStorageRepository | StorageTourStorageRepository;
    if (isStorageLayerTourRepo(tourStore)) {
      return new TourStorageDbAdapter(tourStore);
    }
    return tourStore as DbTourStorageRepository;
  }
  return new TourStorageDbAdapter(createTourStorageRepository());
}
