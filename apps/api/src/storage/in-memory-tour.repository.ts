import { randomUUID } from "node:crypto";

import { deriveTourProjections } from "../canonical/projection-sync";
import { TourVersionConflictError } from "../tours/tour-version-conflict";
import { readTourCapLimits } from "../db/tour-cap-config";
import { TourCapacityExceededError, tourCapacityErrorMessage } from "../db/tour-capacity.error";
import type {
  Tour,
  TourListByTenantPageInput,
  TourListByTenantPageOutput,
  TourStorageRepository,
} from "./tour-storage.interface";

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
export class InMemoryTourRepository implements TourStorageRepository {
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
        tourCapacityErrorMessage("TOUR_CAPACITY_GLOBAL")
      );
    }
    if (this.tenantCount(tenantId) >= limits.maxPerTenant) {
      throw new TourCapacityExceededError(
        "TOUR_CAPACITY_TENANT",
        tourCapacityErrorMessage("TOUR_CAPACITY_TENANT")
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
    const page = await this.listByTenantPage({ tenantId, limit: Number.MAX_SAFE_INTEGER });
    return [...page.items];
  }

  async listByTenantPage(input: TourListByTenantPageInput): Promise<TourListByTenantPageOutput> {
    assertTenantId(input.tenantId);
    const ids = this.idsByTenant.get(input.tenantId);
    if (ids === undefined) {
      return { items: [], nextCursor: null };
    }
    const sorted: Tour[] = [];
    for (const id of ids) {
      const record = this.byId.get(id);
      if (record !== undefined && record.tenantId === input.tenantId) {
        sorted.push(record);
      }
    }
    sorted.sort((left, right) => {
      const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
      return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
    });

    let startIdx = 0;
    if (input.cursor !== undefined) {
      const cursorIdx = sorted.findIndex((tour) => tour.id === input.cursor);
      if (cursorIdx >= 0) {
        startIdx = cursorIdx + 1;
      }
    }

    const page = sorted.slice(startIdx, startIdx + input.limit);
    const hasMore = startIdx + page.length < sorted.length;
    return {
      items: page,
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.id : null,
    };
  }

  /** Create helper for db adapter (assigns id + createdAt). */
  async createTour(input: { tenantId: string; canonical: Tour["canonical"] }): Promise<Tour> {
    const tour: Tour = {
      id: randomUUID(),
      tenantId: input.tenantId,
      canonical: input.canonical,
      createdAt: new Date().toISOString(),
      rowVersion: 1,
    };
    await this.save(tour);
    return tour;
  }

  async updateIfRowVersion(input: {
    tenantId: string;
    id: string;
    canonical: Tour["canonical"];
    expectedRowVersion: number;
  }): Promise<Tour> {
    assertTenantId(input.tenantId);
    const existing = this.byId.get(input.id);
    if (existing === undefined || existing.tenantId !== input.tenantId) {
      throw new TourVersionConflictError();
    }
    if (existing.rowVersion !== input.expectedRowVersion) {
      throw new TourVersionConflictError();
    }
    deriveTourProjections(input.canonical);
    const updated: Tour = {
      ...existing,
      canonical: input.canonical,
      rowVersion: existing.rowVersion + 1,
    };
    this.indexTour(updated);
    return updated;
  }
}
