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

const URBAN_PHASE81_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000410";
const URBAN_PHASE82_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000411";
const URBAN_PHASE81_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const URBAN_SILO_ENTERPRISE_TENANT_ID = "00000000-0000-4000-8000-000000000406";
const URBAN_SILO_ENTERPRISE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000412";
const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_SEED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const OPERATOR_SMOKE_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000211";

function buildOperatorSmokeDenaliCatalogData(input: {
  readonly title: string;
  readonly publishStatus: "draft" | "active";
}): { readonly roots: string[]; readonly data: Record<string, unknown> } {
  const data: Record<string, unknown> = {
    title: input.title,
    publishStatus: input.publishStatus,
    startDateTime: "2026-07-01T08:00:00.000Z",
    endDateTime: "2026-07-03T18:00:00.000Z",
    category: "mountain_multi",
    capacityMax: 12,
    program: {
      shortDescription: "Operator smoke catalog tour",
      difficultyLevel: 6,
      hikingHoursApprox: 8,
      itinerary: [
        {
          dayNumber: 1,
          title: "Summit push",
          summary: "Early alpine start",
          segments: [
            {
              id: "smk-seg-1",
              kind: "activity",
              title: "Ridge ascent",
              startTime: "06:00",
              locationLabel: "North Ridge camp",
              photoIds: ["smk-photo-1"],
            },
          ],
        },
        {
          dayNumber: 2,
          title: "Return leg",
          segments: [
            {
              id: "smk-seg-2",
              kind: "transport",
              title: "Descent to trailhead",
            },
          ],
        },
      ],
    },
    participants: { fitnessLevel: "medium" },
    pricing: { basePricePerPerson: 2500000 },
    photos: [
      {
        id: "smk-photo-1",
        url: "https://cdn.example/north-ridge.jpg",
        label: "Ridge panorama",
        day: 1,
      },
    ],
    basics: { title: input.title },
    details: { summary: "Operator smoke seed tour" },
  };
  return { data, roots: Object.keys(data).sort() };
}

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

  /** Phase 8.1 TPG + 8.2 catalog fixtures — published + draft urban tours. */
  ensureUrbanPhase81PublishedTour(): void {
    if (!this.byId.has(URBAN_PHASE81_PUBLISHED_TOUR_ID)) {
      const published: Tour = {
        id: URBAN_PHASE81_PUBLISHED_TOUR_ID,
        tenantId: URBAN_PHASE81_TENANT_ID,
        rowVersion: 1,
        createdAt: new Date(0).toISOString(),
        canonical: {
          schemaVersion: 1,
          roots: ["tour"],
          data: {
            tour: {
              title: "Berlin city highlights",
              city: "Berlin",
              venueName: "Alexanderplatz",
              startDate: "2026-07-01",
              endDate: "2026-07-02",
              capacity: 100,
              status: "published",
              publishStatus: "published",
              publishedAt: "2026-06-01T12:00:00.000Z",
              catalogSummary: "Summer city nights",
            },
          },
        },
      };
      this.indexTour(published);
    }
    if (!this.byId.has(URBAN_PHASE82_DRAFT_TOUR_ID)) {
      const draft: Tour = {
        id: URBAN_PHASE82_DRAFT_TOUR_ID,
        tenantId: URBAN_PHASE81_TENANT_ID,
        rowVersion: 1,
        createdAt: new Date(1).toISOString(),
        canonical: {
          schemaVersion: 1,
          roots: ["tour"],
          data: {
            tour: {
              title: "Urban draft fixture",
              city: "Tehran",
              venueName: "Side Hall",
              startDate: "2026-08-01",
              endDate: "2026-08-02",
              capacity: 50,
              status: "draft",
              publishStatus: "draft",
            },
          },
        },
      };
      this.indexTour(draft);
    }
  }

  /** Phase 9.8 smoke — operator tour for manual booking create (SMK-P9-07). */
  ensureOperatorSmokeSeedTour(): void {
    if (!this.byId.has(OPERATOR_SMOKE_SEED_TOUR_ID)) {
      const published = buildOperatorSmokeDenaliCatalogData({
        title: "North Ridge Trek",
        publishStatus: "active",
      });
      const tour: Tour = {
        id: OPERATOR_SMOKE_SEED_TOUR_ID,
        tenantId: OPERATOR_SMOKE_TENANT_ID,
        rowVersion: 1,
        createdAt: new Date(0).toISOString(),
        canonical: {
          schemaVersion: 1,
          roots: published.roots,
          data: published.data,
        },
      };
      this.indexTour(tour);
    }
    if (!this.byId.has(OPERATOR_SMOKE_DRAFT_TOUR_ID)) {
      const draftCanonical = buildOperatorSmokeDenaliCatalogData({
        title: "Denali draft fixture",
        publishStatus: "draft",
      });
      const draft: Tour = {
        id: OPERATOR_SMOKE_DRAFT_TOUR_ID,
        tenantId: OPERATOR_SMOKE_TENANT_ID,
        rowVersion: 1,
        createdAt: new Date(1).toISOString(),
        canonical: {
          schemaVersion: 1,
          roots: draftCanonical.roots,
          data: draftCanonical.data,
        },
      };
      this.indexTour(draft);
    }
  }

  /** Phase 8.3 silo enterprise fixture — published catalog tour on dedicated tenant id. */
  ensureUrbanSiloEnterpriseCatalogFixture(): void {
    if (!this.byId.has(URBAN_SILO_ENTERPRISE_PUBLISHED_TOUR_ID)) {
      const published: Tour = {
        id: URBAN_SILO_ENTERPRISE_PUBLISHED_TOUR_ID,
        tenantId: URBAN_SILO_ENTERPRISE_TENANT_ID,
        rowVersion: 1,
        createdAt: new Date(2).toISOString(),
        canonical: {
          schemaVersion: 1,
          roots: ["tour"],
          data: {
            tour: {
              title: "Urban silo enterprise fixture",
              city: "Berlin",
              venueName: "Enterprise Hall",
              startDate: "2026-09-01",
              endDate: "2026-09-02",
              capacity: 200,
              status: "published",
              publishStatus: "published",
              publishedAt: "2026-06-08T12:00:00.000Z",
              catalogSummary: "Dedicated silo tier catalog",
            },
          },
        },
      };
      this.indexTour(published);
    }
  }

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
