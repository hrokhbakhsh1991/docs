import { randomUUID } from "node:crypto";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import type { Prisma } from "@prisma/client";

import { readTourCapLimits } from "../db/tour-cap-config";
import { TourCapacityExceededError, tourCapacityErrorMessage } from "../db/tour-capacity.error";
import { getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import type { Tour, TourIdResolver, TourStorageRepository } from "./tour-storage.interface";

const CROSS_TENANT_SAVE = "FORBIDDEN_TOUR_STORAGE_CROSS_TENANT";

function assertTenantId(tenantId: string): void {
  if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
    throw new Error("INVALID_TENANT_ID");
  }
}

function toTour(row: {
  id: string;
  tenantId: string;
  canonical: Prisma.JsonValue;
  createdAt: Date;
}): Tour {
  return {
    id: row.id,
    tenantId: row.tenantId,
    canonical: row.canonical as unknown as CanonicalDocument,
    createdAt: row.createdAt.toISOString(),
  };
}

function tenantIdIdWhere(tenantId: string, id: string) {
  return { tenantId_id: { tenantId, id } };
}

/**
 * Postgres {@link TourStorageRepository} — tenant compound lookups only (application-layer RLS).
 */
export class PrismaTourRepository implements TourStorageRepository, TourIdResolver {
  private async assertCapacity(tenantId: string): Promise<void> {
    const limits = readTourCapLimits();
    const [globalCount, tenantCount] = await withTenantRls(tenantId, async (tx) =>
      Promise.all([tx.tour.count(), tx.tour.count({ where: { tenantId } })]),
    );
    if (globalCount >= limits.maxGlobal) {
      throw new TourCapacityExceededError(
        "TOUR_CAPACITY_GLOBAL",
        tourCapacityErrorMessage("TOUR_CAPACITY_GLOBAL"),
      );
    }
    if (tenantCount >= limits.maxPerTenant) {
      throw new TourCapacityExceededError(
        "TOUR_CAPACITY_TENANT",
        tourCapacityErrorMessage("TOUR_CAPACITY_TENANT"),
      );
    }
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
    const existing = await this.resolveById(tour.id);
    if (existing !== null && existing.tenantId !== tour.tenantId) {
      throw new Error(CROSS_TENANT_SAVE);
    }

    if (existing === null) {
      await this.assertCapacity(tour.tenantId);
    }

    await withTenantRls(tour.tenantId, async (tx) => {
      if (existing === null) {
        await tx.tour.create({
          data: {
            id: tour.id,
            tenantId: tour.tenantId,
            canonical: tour.canonical as unknown as Prisma.InputJsonValue,
            createdAt: new Date(tour.createdAt),
          },
        });
        return;
      }

      await tx.tour.update({
        where: tenantIdIdWhere(tour.tenantId, tour.id),
        data: {
          canonical: tour.canonical as unknown as Prisma.InputJsonValue,
        },
      });
    });
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

  /** CASL cross-tenant probe — id-only; never use for handler responses. */
  async resolveById(id: string): Promise<Tour | null> {
    const row = await getPrismaAdmin().tour.findUnique({
      where: { id },
    });
    return row === null ? null : toTour(row);
  }

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
