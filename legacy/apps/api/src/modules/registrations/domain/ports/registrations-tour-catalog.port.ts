import type { EntityManager } from "typeorm";

export const REGISTRATIONS_TOUR_CATALOG_PORT = "REGISTRATIONS_TOUR_CATALOG_PORT";

export type TourCatalogSnapshot = {
  id: string;
  tenantId: string;
  title?: string;
  lifecycleStatus: string;
  acceptedCount: number;
  totalCapacity: number;
  autoAcceptRegistrations: boolean | null;
  costContext: Record<string, unknown> | null;
  details: { tripDetails: Record<string, unknown> | null } | null;
  tourDepartureId: string | null;
  transportModes?: string[];
};

export interface RegistrationsTourCatalogPort {
  getTourSnapshot(manager: EntityManager, tourId: string): Promise<TourCatalogSnapshot | null>;
  lockTourSnapshot(manager: EntityManager, tourId: string, tenantId: string): Promise<TourCatalogSnapshot | null>;
  getTourTitles(manager: EntityManager, tourIds: string[], tenantId: string): Promise<Map<string, string>>;
  applyAcceptedCounterDelta(manager: EntityManager, tourId: string, tenantId: string, delta: number): Promise<void>;
  tryIncrementAcceptedCountAtomic(
    manager: EntityManager,
    tourId: string,
    tenantId: string
  ): Promise<TourCatalogSnapshot | null>;
  tryDecrementAcceptedCountAtomic(
    manager: EntityManager,
    tourId: string,
    tenantId: string
  ): Promise<TourCatalogSnapshot | null>;
  syncTourDepartureCapacity(manager: EntityManager, tourId: string, tenantId: string, acceptedCount: number, totalCapacity: number, lifecycleStatus: string): Promise<void>;
}
