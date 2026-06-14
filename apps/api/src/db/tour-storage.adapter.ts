import type { Tour, TourListPageInput, TourListPageResult, TourRecord, TourWhere } from "./tour-record";
import type { TourStorageRepository as DbTourStorageRepository } from "./tour.repository";
import { InMemoryTourRepository } from "../storage/in-memory-tour.repository";
import type {
  Tour,
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
    const rows = await this.store.listByTenant(where.tenantId);
    if (where.id === undefined) {
      return rows.map(toRecord);
    }
    const hit = rows.find((row) => row.id === where.id);
    return hit === undefined ? [] : [toRecord(hit)];
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
