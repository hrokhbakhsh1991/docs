import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createApiAbility } from "../casl/api-ability";
import type {
  TourListPageInput,
  TourListPageResult,
  TourRecord,
  TourWhere,
} from "../db/tour-record";
import type { TourStorageRepository } from "../db/tour.repository";
import { CanonicalTourService } from "./canonical-tour.service";
import { LegacyCanonicalAdapter } from "./legacy-canonical-adapter";
import { runWithTenantContext } from "../tenant/tenant-request-context";

class CountingTourStore implements TourStorageRepository {
  findManyCalls = 0;

  async findMany(_where: TourWhere): Promise<readonly TourRecord[]> {
    this.findManyCalls += 1;
    return [];
  }

  async findFirst(): Promise<TourRecord | null> {
    return null;
  }

  async listPage(_where: TourWhere, _page: TourListPageInput): Promise<TourListPageResult> {
    return { items: [], nextCursor: null };
  }

  async findById(): Promise<TourRecord | null> {
    return null;
  }

  async create(data: {
    tenantId: string;
    canonical: TourRecord["canonical"];
  }): Promise<TourRecord> {
    return {
      id: "tour-1",
      tenantId: data.tenantId,
      canonical: data.canonical,
      createdAt: new Date().toISOString(),
      rowVersion: 1,
    };
  }

  async update(data: {
    tenantId: string;
    id: string;
    canonical: TourRecord["canonical"];
    expectedRowVersion: number;
  }): Promise<TourRecord> {
    return {
      id: data.id,
      tenantId: data.tenantId,
      canonical: data.canonical,
      createdAt: new Date().toISOString(),
      rowVersion: data.expectedRowVersion + 1,
    };
  }
}

describe("CanonicalTourService writeTour (no full scan)", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
  });

  after(() => {
    process.env.STORAGE_DRIVER = priorStorageDriver;
  });

  it("does not call findMany on canonical store after create", async () => {
    const store = new CountingTourStore();
    const service = new CanonicalTourService(store, new LegacyCanonicalAdapter());
    const ability = createApiAbility({
      userId: "u1",
      tenantId: "tenant-a",
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });

    await service.writeTour({
      ability,
      tenantId: "tenant-a",
      workspaceType: "starter",
      body: {
        data: { basics: { title: "x" }, details: { summary: "ok" } },
      },
    });

    assert.equal(store.findManyCalls, 0);
  });

  it("rejects writeTour when ALS tenant differs from input.tenantId (P1-5)", async () => {
    const store = new CountingTourStore();
    const service = new CanonicalTourService(store, new LegacyCanonicalAdapter());
    const ability = createApiAbility({
      userId: "u1",
      tenantId: "tenant-a",
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });
    const body = {
      data: { basics: { title: "mismatch" }, details: { summary: "ok" } },
    } as const;

    await runWithTenantContext("tenant-a", async () => {
      await assert.rejects(
        () =>
          service.writeTour({
            ability,
            tenantId: "tenant-b",
            workspaceType: "starter",
            body,
          }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, "CANONICAL_WRITE_TENANT_MISMATCH");
          return true;
        }
      );
    });
  });

  it("rejects updateTour when ALS tenant differs from input.tenantId (P1-5 / DM-CT-04)", async () => {
    const store = new CountingTourStore();
    const service = new CanonicalTourService(store, new LegacyCanonicalAdapter());
    const ability = createApiAbility({
      userId: "u1",
      tenantId: "tenant-a",
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });

    await runWithTenantContext("tenant-a", async () => {
      await assert.rejects(
        () =>
          service.updateTour({
            ability,
            tenantId: "tenant-b",
            tourId: "tour-1",
            workspaceType: "starter",
            body: { rowVersion: 1, data: { basics: { title: "mismatch" } } },
          }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, "CANONICAL_WRITE_TENANT_MISMATCH");
          return true;
        }
      );
    });
  });
});
