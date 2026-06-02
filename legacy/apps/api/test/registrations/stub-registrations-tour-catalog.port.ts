import type {
  RegistrationsTourCatalogPort,
  TourCatalogSnapshot,
} from "../../src/modules/registrations/domain/ports/registrations-tour-catalog.port";

export type TourCatalogPortTestDoubleState = {
  id: string;
  tenantId: string;
  acceptedCount: number;
  totalCapacity: number;
  lifecycleStatus: string;
  autoAcceptRegistrations?: boolean | null;
  costContext?: Record<string, unknown> | null;
  transportModes?: string[];
};

function toSnapshot(tour: TourCatalogPortTestDoubleState): TourCatalogSnapshot {
  return {
    id: tour.id,
    tenantId: tour.tenantId,
    title: "Test Tour",
    lifecycleStatus: tour.lifecycleStatus,
    acceptedCount: tour.acceptedCount,
    totalCapacity: tour.totalCapacity,
    autoAcceptRegistrations: tour.autoAcceptRegistrations ?? true,
    costContext: tour.costContext ?? {},
    details: { tripDetails: {} },
    tourDepartureId: tour.id,
    transportModes: tour.transportModes ?? ["bus"],
  };
}

export function createRegistrationsTourCatalogPortTestDouble(
  tour: TourCatalogPortTestDoubleState,
  options?: {
    acquireTourLock?: () => Promise<() => void>;
  },
): RegistrationsTourCatalogPort {
  return {
    async getTourSnapshot(_manager, tourId) {
      return tourId === tour.id ? toSnapshot(tour) : null;
    },
    async lockTourSnapshot(_manager, tourId, tenantId) {
      if (tourId !== tour.id || tenantId !== tour.tenantId) {
        return null;
      }
      if (options?.acquireTourLock) {
        await options.acquireTourLock();
      }
      return toSnapshot(tour);
    },
    async getTourTitles(_manager, tourIds, tenantId) {
      const titles = new Map<string, string>();
      if (tourIds.includes(tour.id) && tenantId === tour.tenantId) {
        titles.set(tour.id, "Test Tour");
      }
      return titles;
    },
    async tryIncrementAcceptedCountAtomic(_manager, tourId, tenantId) {
      if (tourId !== tour.id || tenantId !== tour.tenantId) {
        return null;
      }
      if (tour.acceptedCount >= tour.totalCapacity) {
        return null;
      }
      tour.acceptedCount += 1;
      return toSnapshot(tour);
    },
    async tryDecrementAcceptedCountAtomic(_manager, tourId, tenantId) {
      if (tourId !== tour.id || tenantId !== tour.tenantId) {
        return null;
      }
      if (tour.acceptedCount <= 0) {
        return null;
      }
      tour.acceptedCount -= 1;
      return toSnapshot(tour);
    },
    async applyAcceptedCounterDelta(_manager, tourId, tenantId, delta) {
      if (tourId !== tour.id || tenantId !== tour.tenantId) {
        return;
      }
      if (delta > 0) {
        if (tour.acceptedCount >= tour.totalCapacity) {
          return;
        }
        tour.acceptedCount += 1;
        return;
      }
      if (delta < 0) {
        tour.acceptedCount = Math.max(0, tour.acceptedCount + delta);
      }
    },
    async syncTourDepartureCapacity() {},
  };
}
