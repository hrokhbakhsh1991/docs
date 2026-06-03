import { randomUUID } from "node:crypto";

import type { TourRecord, TourWhere } from "./tour-record";
import type { TourStorageRepository } from "./tour.repository";
import { readTourCapLimits } from "./tour-cap-config";
import { TourCapacityExceededError, tourCapacityErrorMessage } from "./tour-capacity.error";

function matchesWhere(record: TourRecord, where: TourWhere): boolean {
  if (record.tenantId !== where.tenantId) return false;
  if (where.id !== undefined && record.id !== where.id) return false;
  return true;
}

export class InMemoryTourRepository implements TourStorageRepository {
  private readonly byId = new Map<string, TourRecord>();
  private readonly byTenant = new Map<string, Set<string>>();

  private get globalCount(): number {
    return this.byId.size;
  }

  private tenantCount(tenantId: string): number {
    return this.byTenant.get(tenantId)?.size ?? 0;
  }

  private assertCapacity(tenantId: string): void {
    const limits = readTourCapLimits();
    if (this.globalCount >= limits.maxGlobal) {
      throw new TourCapacityExceededError(
        "TOUR_CAPACITY_GLOBAL",
        tourCapacityErrorMessage("TOUR_CAPACITY_GLOBAL"),
      );
    }
    if (this.tenantCount(tenantId) >= limits.maxPerTenant) {
      throw new TourCapacityExceededError(
        "TOUR_CAPACITY_TENANT",
        tourCapacityErrorMessage("TOUR_CAPACITY_TENANT"),
      );
    }
  }

  private indexRecord(record: TourRecord): void {
    this.byId.set(record.id, record);
    let ids = this.byTenant.get(record.tenantId);
    if (ids === undefined) {
      ids = new Set();
      this.byTenant.set(record.tenantId, ids);
    }
    ids.add(record.id);
  }

  async findMany(where: TourWhere): Promise<readonly TourRecord[]> {
    if (where.id !== undefined) {
      const record = this.byId.get(where.id);
      if (record === undefined || !matchesWhere(record, where)) return [];
      return [record];
    }
    const ids = this.byTenant.get(where.tenantId);
    if (ids === undefined) return [];
    const out: TourRecord[] = [];
    for (const id of ids) {
      const record = this.byId.get(id);
      if (record !== undefined) out.push(record);
    }
    return out;
  }

  async findFirst(where: TourWhere): Promise<TourRecord | null> {
    if (where.id !== undefined) {
      const record = this.byId.get(where.id);
      if (record === undefined || !matchesWhere(record, where)) return null;
      return record;
    }
    const ids = this.byTenant.get(where.tenantId);
    if (ids === undefined) return null;
    for (const id of ids) {
      const record = this.byId.get(id);
      if (record !== undefined && matchesWhere(record, where)) return record;
    }
    return null;
  }

  async findById(id: string): Promise<TourRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async create(data: {
    tenantId: string;
    canonical: TourRecord["canonical"];
  }): Promise<TourRecord> {
    this.assertCapacity(data.tenantId);
    const record: TourRecord = {
      id: randomUUID(),
      tenantId: data.tenantId,
      canonical: data.canonical,
      createdAt: new Date().toISOString(),
    };
    this.indexRecord(record);
    return record;
  }
}
