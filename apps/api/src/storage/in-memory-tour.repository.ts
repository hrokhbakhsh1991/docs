import { randomUUID } from "node:crypto";

import { readTourCapLimits } from "../db/tour-cap-config";
import { TourCapacityExceededError, tourCapacityErrorMessage } from "../db/tour-capacity.error";
import type { Tour, TourIdResolver, TourStorageRepository } from "./tour-storage.interface";

const CROSS_TENANT_SAVE = "FORBIDDEN_TOUR_STORAGE_CROSS_TENANT";

function assertTenantId(tenantId: string): void {
  if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
    throw new Error("INVALID_TENANT_ID");
  }
}

/**
 * In-memory {@link TourStorageRepository} — tenant-partitioned indexes (Phase 3 scaffold / tests).
 * Not for production; swap DI in `main.ts` when Postgres adapter lands.
 */
export class InMemoryTourRepository implements TourStorageRepository, TourIdResolver {
  private readonly byId = new Map<string, Tour>();
  private readonly idsByTenant = new Map<string, Set<string>>();

  private globalCount(): number {
    return this.byId.size;
  }

  private tenantCount(tenantId: string): number {
    return this.idsByTenant.get(tenantId)?.size ?? 0;
  }

  private assertCapacity(tenantId: string): void {
    const limits = readTourCapLimits();
    if (this.globalCount() >= limits.maxGlobal) {
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

  private indexTour(tour: Tour): void {
    this.byId.set(tour.id, tour);
    let ids = this.idsByTenant.get(tour.tenantId);
    if (ids === undefined) {
      ids = new Set();
      this.idsByTenant.set(tour.tenantId, ids);
    }
    ids.add(tour.id);
  }

  async getById(id: string, tenantId: string): Promise<Tour | null> {
    assertTenantId(tenantId);
    const record = this.byId.get(id);
    if (record === undefined) {
      return null;
    }
    if (record.tenantId !== tenantId) {
      return null;
    }
    return record;
  }

  async save(tour: Tour): Promise<void> {
    assertTenantId(tour.tenantId);
    const existing = this.byId.get(tour.id);
    if (existing !== undefined && existing.tenantId !== tour.tenantId) {
      throw new Error(CROSS_TENANT_SAVE);
    }
    if (existing === undefined) {
      this.assertCapacity(tour.tenantId);
    }
    this.indexTour(tour);
  }

  async listByTenant(tenantId: string): Promise<Tour[]> {
    assertTenantId(tenantId);
    const ids = this.idsByTenant.get(tenantId);
    if (ids === undefined) {
      return [];
    }
    const out: Tour[] = [];
    for (const id of ids) {
      const record = this.byId.get(id);
      if (record !== undefined && record.tenantId === tenantId) {
        out.push(record);
      }
    }
    return out;
  }

  /** {@link TourIdResolver} — used by db adapter for CASL cross-tenant probes only. */
  async resolveById(id: string): Promise<Tour | null> {
    return this.byId.get(id) ?? null;
  }

  /** Create helper for db adapter (assigns id + createdAt). */
  async createTour(input: {
    tenantId: string;
    canonical: Tour["canonical"];
  }): Promise<Tour> {
    const tour: Tour = {
      id: randomUUID(),
      tenantId: input.tenantId,
      canonical: input.canonical,
      createdAt: new Date().toISOString(),
    };
    await this.save(tour);
    return tour;
  }
}
