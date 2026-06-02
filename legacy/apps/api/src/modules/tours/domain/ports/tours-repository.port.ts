import type { RegionalTourListScope } from "../../../../common/rbac/capability-grant-context-from-request";
import type { TourWriteRecord } from "../tour-write-record.types";
import type { TourFilter, TourSort } from "@repo/shared-contracts";

export const TOURS_CATALOG_REPOSITORY_PORT = Symbol("TOURS_CATALOG_REPOSITORY_PORT");

export type ToursCatalogListPageInput = {
  tenantId: string;
  filter: TourFilter;
  sort?: TourSort;
  includeTotal?: boolean;
  regionalScope: RegionalTourListScope;
  page: number;
  limit: number;
  useKeyset: boolean;
  cursorAt: Date | null;
  cursorId: string | null;
};

export type ToursCatalogListPageOutput = {
  items: TourWriteRecord[];
  total: number;
  page: number;
  limit: number;
};

export interface ToursCatalogRepositoryPort {
  listTours(input: ToursCatalogListPageInput): Promise<ToursCatalogListPageOutput>;

  findByIdOrThrow(tourId: string, tenantId: string): Promise<TourWriteRecord>;

  findById(tourId: string, tenantId: string): Promise<TourWriteRecord | null>;
}

export const TOURS_WRITE_REPOSITORY_PORT = Symbol("TOURS_WRITE_REPOSITORY_PORT");

/**
 * Domain port for Tour writing.
 */
export interface ToursWriteRepositoryPort {
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>;

  createTourEntity(data: any): TourWriteRecord;

  /** Save new tour, reload with response relations, sync product/departure rows. */
  createTour(tour: TourWriteRecord, tenantId: string): Promise<TourWriteRecord>;

  loadTourForUpdateLocking(
    tourId: string,
    tenantId: string
  ): Promise<TourWriteRecord | null>;

  /** Save tour patch, reload with response relations, sync product/departure rows. */
  updateTour(tour: TourWriteRecord, tenantId: string): Promise<TourWriteRecord>;

  syncProductDepartureForTour(tour: TourWriteRecord): Promise<void>;
}
