import type { ToursService } from "../tours/tours.service";

let toursServicePromise: Promise<ToursService> | null = null;

export function resetLazyToursServiceForTests(): void {
  toursServicePromise = null;
}

export async function resolveLazyToursService(injected?: ToursService): Promise<ToursService> {
  if (injected !== undefined) {
    return injected;
  }
  if (toursServicePromise === null) {
    toursServicePromise = (async () => {
      const [
        { TourStorageDbAdapter },
        { createTourStorageRepository },
        { CanonicalTourService },
        { LegacyCanonicalAdapter },
        { ToursService: ToursServiceCtor },
      ] = await Promise.all([
        import("../db/tour-storage.adapter"),
        import("../storage/create-tour-storage"),
        import("../canonical/canonical-tour.service"),
        import("../canonical/legacy-canonical-adapter"),
        import("../tours/tours.service"),
      ]);
      const canonicalStore = new TourStorageDbAdapter(createTourStorageRepository());
      const canonicalTourService = new CanonicalTourService(
        canonicalStore,
        new LegacyCanonicalAdapter()
      );
      return new ToursServiceCtor(canonicalTourService);
    })();
  }
  return toursServicePromise;
}
