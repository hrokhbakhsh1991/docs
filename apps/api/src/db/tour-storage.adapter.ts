import type { TourListPageInput, TourListPageResult, TourRecord, TourWhere } from "./tour-record";
import type { TourStorageRepository as DbTourStorageRepository } from "./tour.repository";
import { InMemoryTourRepository } from "../storage/in-memory-tour.repository";
import { TOUR_LIST_PAGE_CHUNK_SIZE } from "./load-all-tour-records-via-list-page";
import type {
  Tour,
  TourOperatorListPageInput,
  TourOperatorListPageOutput,
  TourStorageRepository as StorageTourRepository,
} from "../storage/tour-storage.interface";

function toRecord(tour: Tour): TourRecord {
  return {
    id: tour.id,
    tenantId: tour.tenantId,
    canonical: tour.canonical,
    createdAt: tour.createdAt,
    rowVersion: tour.rowVersion,
  };
}

/**
 * Bridges {@link StorageTourRepository} (tenant-scoped port) to the db {@link DbTourStorageRepository}
 * expected by {@link ScopedTourRepository}.
 */
export class TourStorageDbAdapter implements DbTourStorageRepository {
  constructor(
    private readonly store: StorageTourRepository & {
      createTour(data: { tenantId: string; canonical: Tour["canonical"] }): Promise<Tour>;
      updateIfRowVersion(input: {
        tenantId: string;
        id: string;
        canonical: Tour["canonical"];
        expectedRowVersion: number;
      }): Promise<Tour>;
    }
  ) {}

  /** Dev memory — unwrap in-memory repository for idempotent smoke seed helpers. */
  devMemoryStore(): InMemoryTourRepository | null {
    return this.store instanceof InMemoryTourRepository ? this.store : null;
  }

  async findMany(where: TourWhere): Promise<readonly TourRecord[]> {
    if (where.id !== undefined) {
      const hit = await this.store.getById(where.id, where.tenantId);
      return hit === null ? [] : [toRecord(hit)];
    }
    const items: TourRecord[] = [];
    let cursor: string | undefined;
    for (;;) {
      const result = await this.store.listByTenantPage({
        tenantId: where.tenantId,
        limit: TOUR_LIST_PAGE_CHUNK_SIZE,
        ...(cursor !== undefined ? { cursor } : {}),
      });
      items.push(...result.items.map(toRecord));
      if (result.nextCursor === null) {
        return items;
      }
      cursor = result.nextCursor;
    }
  }

  async listPage(where: TourWhere, page: TourListPageInput): Promise<TourListPageResult> {
    const result = await this.store.listByTenantPage({
      tenantId: where.tenantId,
      limit: page.limit,
      cursor: page.cursor,
    });
    return {
      items: result.items.map(toRecord),
      nextCursor: result.nextCursor,
    };
  }

  async listOperatorToursPage(
    tenantId: string,
    query: TourOperatorListPageInput["query"]
  ): Promise<TourOperatorListPageOutput> {
    const result = await this.store.listOperatorToursPage({ tenantId, query });
    return {
      items: result.items.map(toRecord),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async findFirst(where: TourWhere): Promise<TourRecord | null> {
    if (where.id !== undefined) {
      const hit = await this.store.getById(where.id, where.tenantId);
      return hit === null ? null : toRecord(hit);
    }
    const rows = await this.store.listByTenant(where.tenantId);
    const first = rows[0];
    return first === undefined ? null : toRecord(first);
  }

  async create(data: {
    tenantId: string;
    canonical: TourRecord["canonical"];
  }): Promise<TourRecord> {
    const created = await this.store.createTour(data);
    return toRecord(created);
  }

  async update(data: {
    tenantId: string;
    id: string;
    canonical: TourRecord["canonical"];
    expectedRowVersion: number;
  }): Promise<TourRecord> {
    const updated = await this.store.updateIfRowVersion(data);
    return toRecord(updated);
  }
}
