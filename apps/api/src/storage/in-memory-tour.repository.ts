import { randomUUID } from "node:crypto";

import {
  buildDenaliClubDevDraftTour,
  buildDenaliClubDevPublishedTour,
  buildOperatorSmokeParticipantRequirementsTour,
  buildOperatorSmokePublishedTourItinerary,
  buildOperatorSmokeTransportBusTour,
  buildOperatorSmokeTransportSharedCarsTour,
  DENALI_CLUB_DEV_DRAFT_TOUR_ID,
  DENALI_CLUB_DEV_PUBLISHED_TOUR_ID,
  OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG,
  OPERATOR_SMOKE_PUBLISHED_TOUR_COVER_URL,
  OPERATOR_SMOKE_PUBLISHED_TOUR_POLICIES_TEXT,
  OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID,
} from "../fixtures/operator-smoke-published-tour.fixture";
import { OPERATOR_DENALI_SMOKE_TENANT_ID } from "../internal/operator-smoke-tenant-id";
import { deriveTourProjections } from "../canonical/projection-sync";
import { TourVersionConflictError } from "../tours/tour-version-conflict";
import { readTourCapLimits } from "../db/tour-cap-config";
import { TourCapacityExceededError, tourCapacityErrorMessage } from "../db/tour-capacity.error";
import type {
  Tour,
  TourListByTenantPageInput,
  TourListByTenantPageOutput,
  TourOperatorListPageInput,
  TourOperatorListPageOutput,
  TourStorageRepository,
} from "./tour-storage.interface";
import type { OperatorListSortBy, OperatorListSortDir } from "../tours/operator-tour-list-types";
import { publishStatusesForOperatorFilter } from "../tours/operator-tour-list-db-query";

function tourStorageKey(tenantId: string, id: string): string {
  return `${tenantId}\u0000${id}`;
}

function compareInMemoryOperatorTours(
  left: Tour,
  right: Tour,
  sortBy: OperatorListSortBy,
  sortDir: OperatorListSortDir
): number {
  const leftProj = deriveTourProjections(left.canonical);
  const rightProj = deriveTourProjections(right.canonical);
  let delta = 0;
  if (sortBy === "title") {
    delta = (leftProj.title ?? "").localeCompare(rightProj.title ?? "");
  } else if (sortBy === "departure_at") {
    const leftDate =
      typeof left.canonical.data?.startDateTime === "string" ? left.canonical.data.startDateTime : "";
    const rightDate =
      typeof right.canonical.data?.startDateTime === "string" ? right.canonical.data.startDateTime : "";
    delta = leftDate.localeCompare(rightDate);
  } else {
    delta = left.createdAt.localeCompare(right.createdAt);
  }
  return sortDir === "asc" ? delta : -delta;
}

const URBAN_PHASE81_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000410";
const URBAN_PHASE82_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000411";
const URBAN_PHASE81_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const URBAN_SILO_ENTERPRISE_TENANT_ID = "00000000-0000-4000-8000-000000000406";
const URBAN_SILO_ENTERPRISE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000412";
const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_SEED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const OPERATOR_SMOKE_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000211";
const OPERATOR_SMOKE_PARTICIPANT_TOUR_ID = "00000000-0000-4000-8000-000000000212";

function buildOperatorSmokeDenaliCatalogData(input: {
  readonly title: string;
  readonly publishStatus: "draft" | "active";
}): { readonly roots: string[]; readonly data: Record<string, unknown> } {
  const catalog = OPERATOR_SMOKE_PUBLISHED_TOUR_CATALOG;
  const data: Record<string, unknown> = {
    title: input.title,
    publishStatus: input.publishStatus,
    startDateTime: "2026-07-01T08:00:00.000Z",
    endDateTime: "2026-07-03T18:00:00.000Z",
    category: "mountain_multi",
    capacityMax: 12,
    destinationId: catalog.destinationId,
    program: {
      shortDescription: "Operator smoke catalog tour",
      difficultyLevel: 6,
      hikingHoursApprox: 8,
      themeIds: [catalog.themeId],
      itinerary: [...buildOperatorSmokePublishedTourItinerary()],
    },
    participants: { fitnessLevel: "medium", minimumAge: 16 },
    pricing: { basePricePerPerson: 2500000, paymentMode: "offline_receipt" },
    transport: { mode: "none" },
    photos: [
      {
        id: "smk-photo-1",
        url: OPERATOR_SMOKE_PUBLISHED_TOUR_COVER_URL,
        label: "Ridge panorama",
        day: 1,
      },
    ],
    tripDetails: {
      overview: {
        peakHeight: catalog.peakHeight,
        customServiceLabels: [],
      },
    },
    basics: { title: input.title },
    details: { summary: "Operator smoke seed tour" },
  };
  if (input.publishStatus === "active") {
    data.policies = {
      policiesText: OPERATOR_SMOKE_PUBLISHED_TOUR_POLICIES_TEXT,
      cancellationDeadlineHours: 48,
      cancellationPenaltyPercentage: 20,
    };
  }
  return { data, roots: Object.keys(data) };
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

  /** Denali dev host tenant (…000003) — FE-14 / TR-09 memory seed (ED-SEED-01 ≥2 tours). */
  ensureDenaliDevSmokeSeedTour(): void {
    const tenantId = OPERATOR_DENALI_SMOKE_TENANT_ID;
    if (!this.hasTour(tenantId, DENALI_CLUB_DEV_PUBLISHED_TOUR_ID)) {
      this.indexTour(buildDenaliClubDevPublishedTour({ tenantId }));
    }
    if (!this.hasTour(tenantId, DENALI_CLUB_DEV_DRAFT_TOUR_ID)) {
      this.indexTour(buildDenaliClubDevDraftTour({ tenantId }));
    }
    if (!this.hasTour(tenantId, OPERATOR_SMOKE_PARTICIPANT_TOUR_ID)) {
      this.indexTour(buildOperatorSmokeParticipantRequirementsTour({ tenantId }));
    }
    if (!this.hasTour(tenantId, OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID)) {
      this.indexTour(buildOperatorSmokeTransportBusTour({ tenantId }));
    }
    if (!this.hasTour(tenantId, OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID)) {
      this.indexTour(buildOperatorSmokeTransportSharedCarsTour({ tenantId }));
    }
  }

  /** Phase 9.8 smoke — operator tour for manual booking create (SMK-P9-07). */
  ensureOperatorSmokeSeedTour(): void {
    if (!this.hasTour(OPERATOR_SMOKE_TENANT_ID, OPERATOR_SMOKE_SEED_TOUR_ID)) {
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
    if (!this.hasTour(OPERATOR_SMOKE_TENANT_ID, OPERATOR_SMOKE_DRAFT_TOUR_ID)) {
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
    if (!this.hasTour(OPERATOR_SMOKE_TENANT_ID, OPERATOR_SMOKE_PARTICIPANT_TOUR_ID)) {
      this.indexTour(
        buildOperatorSmokeParticipantRequirementsTour({ tenantId: OPERATOR_SMOKE_TENANT_ID })
      );
    }
    if (!this.hasTour(OPERATOR_SMOKE_TENANT_ID, OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID)) {
      this.indexTour(buildOperatorSmokeTransportBusTour({ tenantId: OPERATOR_SMOKE_TENANT_ID }));
    }
    if (!this.hasTour(OPERATOR_SMOKE_TENANT_ID, OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID)) {
      this.indexTour(
        buildOperatorSmokeTransportSharedCarsTour({ tenantId: OPERATOR_SMOKE_TENANT_ID })
      );
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

  private hasTour(tenantId: string, id: string): boolean {
    return this.byId.has(tourStorageKey(tenantId, id));
  }

  private indexTour(tour: Tour): void {
    this.byId.set(tourStorageKey(tour.tenantId, tour.id), tour);
    let ids = this.idsByTenant.get(tour.tenantId);
    if (ids === undefined) {
      ids = new Set();
      this.idsByTenant.set(tour.tenantId, ids);
    }
    ids.add(tour.id);
  }

  async getById(id: string, tenantId: string): Promise<Tour | null> {
    assertTenantId(tenantId);
    return this.byId.get(tourStorageKey(tenantId, id)) ?? null;
  }

  async getByIds(ids: readonly string[], tenantId: string): Promise<Tour[]> {
    assertTenantId(tenantId);
    const unique = [
      ...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)),
    ];
    const out: Tour[] = [];
    for (const id of unique) {
      const tour = this.byId.get(tourStorageKey(tenantId, id));
      if (tour !== undefined) {
        out.push(tour);
      }
    }
    return out;
  }

  async save(tour: Tour): Promise<void> {
    assertTenantId(tour.tenantId);
    const existing = this.byId.get(tourStorageKey(tour.tenantId, tour.id));
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
      const record = this.byId.get(tourStorageKey(input.tenantId, id));
      if (record !== undefined) {
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

  async listOperatorToursPage(input: TourOperatorListPageInput): Promise<TourOperatorListPageOutput> {
    assertTenantId(input.tenantId);
    const { query } = input;
    const allPage = await this.listByTenantPage({
      tenantId: input.tenantId,
      limit: Number.MAX_SAFE_INTEGER,
    });
    let items = [...allPage.items];
    const search = query.search?.trim().toLocaleLowerCase();
    if (search !== undefined && search.length > 0) {
      items = items.filter((tour) => {
        const title = (deriveTourProjections(tour.canonical).title ?? "").toLocaleLowerCase();
        return title.includes(search);
      });
    }
    if (query.status !== undefined) {
      const allowed = new Set(publishStatusesForOperatorFilter(query.status));
      items = items.filter((tour) => {
        const publishStatus =
          typeof tour.canonical.data?.publishStatus === "string"
            ? tour.canonical.data.publishStatus
            : "";
        return allowed.has(publishStatus);
      });
    }
    items.sort((left, right) => compareInMemoryOperatorTours(left, right, query.sortBy, query.sortDir));
    const total = items.length;
    const offset = (query.page - 1) * query.limit;
    const pageItems = items.slice(offset, offset + query.limit);
    return {
      items: pageItems,
      total: query.includeTotal ? total : pageItems.length,
      page: query.page,
      limit: query.limit,
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
    const existing = this.byId.get(tourStorageKey(input.tenantId, input.id));
    if (existing === undefined) {
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
