import { randomUUID } from "node:crypto";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import { Prisma } from "@prisma/client";

import { deriveTourProjections } from "../canonical/projection-sync";
import { TourVersionConflictError } from "../tours/tour-version-conflict";
import { readTourCapLimits } from "../db/tour-cap-config";
import { TourCapacityExceededError, tourCapacityErrorMessage } from "../db/tour-capacity.error";
import { withTenantRls } from "../db/with-tenant-rls";
import { requireActiveTenantId } from "../tenant/tenant-request-context";
import type { Tour, TourStorageRepository } from "./tour-storage.interface";

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
    assertTenantId(tenantId);
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.tour.findMany({
        where: { tenantId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(toTour);
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
