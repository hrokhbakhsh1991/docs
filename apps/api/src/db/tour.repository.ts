import type { TourListPageInput, TourListPageResult, TourRecord, TourWhere } from "./tour-record";

/** Policy-facing repository — handlers use ScopedTourRepository only. */
export interface TourRepository {
  findMany(where: TourWhere): Promise<readonly TourRecord[]>;
  findFirst(where: TourWhere): Promise<TourRecord | null>;
  listPage(where: TourWhere, page: TourListPageInput): Promise<TourListPageResult>;
  create(data: { tenantId: string; canonical: TourRecord["canonical"] }): Promise<TourRecord>;
  update(data: {
    tenantId: string;
    id: string;
    canonical: TourRecord["canonical"];
    expectedRowVersion: number;
  }): Promise<TourRecord>;
}

/** Storage adapter — tenant-scoped reads via findFirst/findMany only (DM-CT-03). */
export type TourStorageRepository = TourRepository;
