import type { TourRecord, TourWhere } from "./tour-record";
import type { TourStorageRepository as DbTourStorageRepository } from "./tour.repository";
import type {
  Tour,
  TourIdResolver,
  TourStorageRepository as StorageTourRepository,
} from "../storage/tour-storage.interface";

function toRecord(tour: Tour): TourRecord {
  return {
    id: tour.id,
    tenantId: tour.tenantId,
    canonical: tour.canonical,
    createdAt: tour.createdAt,
  };
}

/**
 * Bridges {@link StorageTourRepository} (tenant-scoped port) to the db {@link DbTourStorageRepository}
 * expected by {@link ScopedTourRepository}.
 */
export class TourStorageDbAdapter implements DbTourStorageRepository {
  constructor(
    private readonly store: StorageTourRepository & TourIdResolver & {
      createTour(data: { tenantId: string; canonical: Tour["canonical"] }): Promise<Tour>;
    },
  ) {}

  async findMany(where: TourWhere): Promise<readonly TourRecord[]> {
    const rows = await this.store.listByTenant(where.tenantId);
    if (where.id === undefined) {
      return rows.map(toRecord);
    }
    const hit = rows.find((row) => row.id === where.id);
    return hit === undefined ? [] : [toRecord(hit)];
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

  async findById(id: string): Promise<TourRecord | null> {
    const hit = await this.store.resolveById(id);
    return hit === null ? null : toRecord(hit);
  }

  async create(data: {
    tenantId: string;
    canonical: TourRecord["canonical"];
  }): Promise<TourRecord> {
    const created = await this.store.createTour(data);
    return toRecord(created);
  }
}
