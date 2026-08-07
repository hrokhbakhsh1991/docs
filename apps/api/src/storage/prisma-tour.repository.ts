import { randomUUID } from "node:crypto";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import { Prisma } from "@prisma/client";

import { deriveTourProjections } from "../canonical/projection-sync";
import { TourVersionConflictError } from "../tours/tour-version-conflict";
import {
  buildOperatorTourOrderBy,
  buildOperatorTourWhere,
  OPERATOR_TOUR_LIST_SELECT,
} from "../tours/operator-tour-list-db-query";
import { readTourCapLimits } from "../db/tour-cap-config";
import { TourCapacityExceededError, tourCapacityErrorMessage } from "../db/tour-capacity.error";
import { withTenantRls } from "../db/with-tenant-rls";
import { requireActiveTenantId } from "../tenant/tenant-request-context";
import type {
  Tour,
  TourListByTenantPageInput,
  TourListByTenantPageOutput,
  TourOperatorListPageInput,
  TourOperatorListPageOutput,
  TourStorageRepository,
} from "./tour-storage.interface";

export const TOUR_LIST_PAGE_SELECT = {
  id: true,
  tenantId: true,
  canonical: true,
  createdAt: true,
  rowVersion: true,
} as const satisfies Prisma.TourSelect;

const CROSS_TENANT_SAVE = "FORBIDDEN_TOUR_STORAGE_CROSS_TENANT";

function assertTenantId(tenantId: string): void {
  if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
    throw new Error("INVALID_TENANT_ID");
  }
}

function isPrismaUniqueConstraintOnTourId(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (!Array.isArray(target)) {
    // Prisma sometimes omits meta.target on id collisions — treat as cross-tenant save.
    return true;
  }
  return target.includes("id") || target.includes("tenantId_id");
}

function toTour(row: {
  id: string;
  tenantId: string;
  canonical: Prisma.JsonValue;
  createdAt: Date;
  rowVersion: number;
}): Tour {
  return {
    id: row.id,
    tenantId: row.tenantId,
    canonical: row.canonical as unknown as CanonicalDocument,
    createdAt: row.createdAt.toISOString(),
    rowVersion: row.rowVersion,
  };
}

function tenantIdIdWhere(tenantId: string, id: string) {
  return { tenantId_id: { tenantId, id } };
}

/**
 * Postgres {@link TourStorageRepository} — tenant compound lookups only (application-layer RLS).
 */
export class PrismaTourRepository implements TourStorageRepository {
  private async assertCapacity(tenantId: string): Promise<void> {
    const limits = readTourCapLimits();
    const [globalCount, tenantCount] = await withTenantRls(tenantId, async (tx) =>
      Promise.all([tx.tour.count(), tx.tour.count({ where: { tenantId } })])
    );
    if (globalCount >= limits.maxGlobal) {
      throw new TourCapacityExceededError(
        "TOUR_CAPACITY_GLOBAL",
        tourCapacityErrorMessage("TOUR_CAPACITY_GLOBAL")
      );
    }
    if (tenantCount >= limits.maxPerTenant) {
      throw new TourCapacityExceededError(
        "TOUR_CAPACITY_TENANT",
        tourCapacityErrorMessage("TOUR_CAPACITY_TENANT")
      );
    }
  }

  /**
   * Resolves tour by id under the AsyncLocalStorage-bound tenant (still uses {@link withTenantRls}).
   */
  async getByIdForActiveContext(id: string): Promise<Tour | null> {
    return this.getById(id, requireActiveTenantId());
  }

  async getById(id: string, tenantId: string): Promise<Tour | null> {
    assertTenantId(tenantId);
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.tour.findUnique({
        where: tenantIdIdWhere(tenantId, id),
      });
      return row === null ? null : toTour(row);
    });
  }

  async getByIds(ids: readonly string[], tenantId: string): Promise<Tour[]> {
    assertTenantId(tenantId);
    const unique = [
      ...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)),
    ];
    if (unique.length === 0) {
      return [];
    }
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.tour.findMany({
        where: { tenantId, id: { in: unique } },
      });
      return rows.map(toTour);
    });
  }

  async save(tour: Tour): Promise<void> {
    assertTenantId(tour.tenantId);
    const existing = await this.getById(tour.id, tour.tenantId);
    const projections = deriveTourProjections(tour.canonical);

    if (existing !== null) {
      await withTenantRls(tour.tenantId, async (tx) => {
        await tx.tour.update({
          where: tenantIdIdWhere(tour.tenantId, tour.id),
          data: {
            canonical: tour.canonical as unknown as Prisma.InputJsonValue,
            title: projections.title,
            schemaVersion: projections.schemaVersion,
            rowVersion: tour.rowVersion,
          },
        });
      });
      return;
    }

    await this.assertCapacity(tour.tenantId);
    try {
      await withTenantRls(tour.tenantId, async (tx) => {
        await tx.tour.create({
          data: {
            id: tour.id,
            tenantId: tour.tenantId,
            canonical: tour.canonical as unknown as Prisma.InputJsonValue,
            title: projections.title,
            schemaVersion: projections.schemaVersion,
            rowVersion: tour.rowVersion,
            createdAt: new Date(tour.createdAt),
          },
        });
      });
    } catch (error: unknown) {
      if (isPrismaUniqueConstraintOnTourId(error)) {
        throw new Error(CROSS_TENANT_SAVE);
      }
      throw error;
    }
  }

  async updateIfRowVersion(input: {
    tenantId: string;
    id: string;
    canonical: CanonicalDocument;
    expectedRowVersion: number;
  }): Promise<Tour> {
    assertTenantId(input.tenantId);
    const projections = deriveTourProjections(input.canonical);

    const updated = await withTenantRls(input.tenantId, async (tx) => {
      const result = await tx.tour.updateMany({
        where: {
          tenantId: input.tenantId,
          id: input.id,
          rowVersion: input.expectedRowVersion,
        },
        data: {
          canonical: input.canonical as unknown as Prisma.InputJsonValue,
          title: projections.title,
          schemaVersion: projections.schemaVersion,
          rowVersion: input.expectedRowVersion + 1,
        },
      });
      if (result.count !== 1) {
        throw new TourVersionConflictError();
      }
      const row = await tx.tour.findUnique({
        where: tenantIdIdWhere(input.tenantId, input.id),
      });
      if (row === null) {
        throw new TourVersionConflictError();
      }
      return toTour(row);
    });

    return updated;
  }

  async listByTenant(tenantId: string): Promise<Tour[]> {
    const page = await this.listByTenantPage({ tenantId, limit: Number.MAX_SAFE_INTEGER });
    return [...page.items];
  }

  async listByTenantPage(input: TourListByTenantPageInput): Promise<TourListByTenantPageOutput> {
    assertTenantId(input.tenantId);
    return withTenantRls(input.tenantId, async (tx) => {
      let keysetWhere: Prisma.TourWhereInput = { tenantId: input.tenantId };
      if (input.cursor !== undefined) {
        const cursorRow = await tx.tour.findUnique({
          where: tenantIdIdWhere(input.tenantId, input.cursor),
        });
        if (cursorRow !== null) {
          keysetWhere = {
            tenantId: input.tenantId,
            OR: [
              { createdAt: { gt: cursorRow.createdAt } },
              {
                createdAt: cursorRow.createdAt,
                id: { gt: cursorRow.id },
              },
            ],
          };
        }
      }

      const rows = await tx.tour.findMany({
        where: keysetWhere,
        select: TOUR_LIST_PAGE_SELECT,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: input.limit + 1,
      });
      const hasMore = rows.length > input.limit;
      const pageRows = rows.slice(0, input.limit);
      return {
        items: pageRows.map(toTour),
        nextCursor: hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1]!.id : null,
      };
    });
  }

  async listOperatorToursPage(input: TourOperatorListPageInput): Promise<TourOperatorListPageOutput> {
    assertTenantId(input.tenantId);
    const { query } = input;
    return withTenantRls(input.tenantId, async (tx) => {
      const where = buildOperatorTourWhere({
        tenantId: input.tenantId,
        search: query.search,
        status: query.status,
      });
      const total = query.includeTotal ? await tx.tour.count({ where }) : 0;
      const rows = await tx.tour.findMany({
        where,
        select: OPERATOR_TOUR_LIST_SELECT,
        orderBy: buildOperatorTourOrderBy(query.sortBy, query.sortDir),
        skip: (input.query.page - 1) * input.query.limit,
        take: input.query.limit,
      });
      return {
        items: rows.map(toTour),
        total: query.includeTotal ? total : rows.length,
        page: query.page,
        limit: query.limit,
      };
    });
  }

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
}
