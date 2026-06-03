import type { TourRecord, TourWhere } from "./tour-record";

/** Policy-facing repository — handlers use ScopedTourRepository only. */
export interface TourRepository {
  findMany(where: TourWhere): Promise<readonly TourRecord[]>;
  findFirst(where: TourWhere): Promise<TourRecord | null>;
  create(data: { tenantId: string; canonical: TourRecord["canonical"] }): Promise<TourRecord>;
}

/** Storage adapter — findById is internal to the scoped policy layer (P3-E-DB-01). */
export interface TourStorageRepository extends TourRepository {
  findById(id: string): Promise<TourRecord | null>;
}
