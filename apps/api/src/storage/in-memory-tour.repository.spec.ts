import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { tourCapacityErrorMessage } from "../db/tour-capacity.error";
import { InMemoryTourRepository } from "./in-memory-tour.repository";

const envSnapshot = { ...process.env };

const sampleCanonical = {
  schemaVersion: 1 as const,
  roots: ["basics"] as const,
  data: { basics: { title: "t" } },
};

afterEach(() => {
  process.env = { ...envSnapshot };
});

describe("InMemoryTourRepository (tenant-scoped storage)", () => {
  it("getById returns null when tenantId does not match (no cross-tenant leak)", async () => {
    const repo = new InMemoryTourRepository();
    const tour = await repo.createTour({ tenantId: "tenant-a", canonical: sampleCanonical });

    const wrongTenant = await repo.getById(tour.id, "tenant-b");
    assert.equal(wrongTenant, null);

    const correctTenant = await repo.getById(tour.id, "tenant-a");
    assert.equal(correctTenant?.id, tour.id);
  });

  it("listByTenantPage paginates with cursor", async () => {
    const repo = new InMemoryTourRepository();
    await repo.createTour({ tenantId: "t1", canonical: sampleCanonical });
    await repo.createTour({ tenantId: "t1", canonical: sampleCanonical });
    await repo.createTour({ tenantId: "t1", canonical: sampleCanonical });

    const sortedIds = (await repo.listByTenant("t1"))
      .sort((left, right) => {
        const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
        return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
      })
      .map((tour) => tour.id);

    const page1 = await repo.listByTenantPage({ tenantId: "t1", limit: 2 });
    assert.deepEqual(
      page1.items.map((tour) => tour.id),
      sortedIds.slice(0, 2)
    );
    assert.equal(page1.nextCursor, page1.items[1]?.id);

    const page2 = await repo.listByTenantPage({
      tenantId: "t1",
      limit: 2,
      cursor: page1.nextCursor ?? undefined,
    });
    assert.deepEqual(
      page2.items.map((tour) => tour.id),
      sortedIds.slice(2)
    );
    assert.equal(page2.nextCursor, null);
  });

  it("listByTenant returns only rows for that tenant", async () => {
    const repo = new InMemoryTourRepository();
    await repo.createTour({ tenantId: "t1", canonical: sampleCanonical });
    await repo.createTour({ tenantId: "t2", canonical: sampleCanonical });

    const t1 = await repo.listByTenant("t1");
    assert.equal(t1.length, 1);
    assert.equal(t1[0]?.tenantId, "t1");

    const t2 = await repo.listByTenant("t2");
    assert.equal(t2.length, 1);
    assert.equal(t2[0]?.tenantId, "t2");
  });

  it("save rejects changing tenantId for an existing id", async () => {
    const repo = new InMemoryTourRepository();
    const created = await repo.createTour({ tenantId: "t1", canonical: sampleCanonical });

    await assert.rejects(
      () =>
        repo.save({
          ...created,
          tenantId: "t2",
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "FORBIDDEN_TOUR_STORAGE_CROSS_TENANT");
        return true;
      }
    );
  });

  it("rejects save when tenant cap exceeded", async () => {
    process.env.MAX_TOURS_PER_TENANT = "1";
    process.env.MAX_TOURS_GLOBAL = "100";
    const repo = new InMemoryTourRepository();
    await repo.createTour({ tenantId: "t1", canonical: sampleCanonical });
    await assert.rejects(
      () => repo.createTour({ tenantId: "t1", canonical: sampleCanonical }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, tourCapacityErrorMessage("TOUR_CAPACITY_TENANT"));
        return true;
      }
    );
  });
});
