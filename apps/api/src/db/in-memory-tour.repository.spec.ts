import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { InMemoryTourRepository } from "./in-memory-tour.repository";
import { tourCapacityErrorMessage } from "./tour-capacity.error";

const envSnapshot = { ...process.env };

const sampleCanonical = {
  schemaVersion: 1 as const,
  roots: ["basics"] as const,
  data: { basics: { title: "t" } },
};

afterEach(() => {
  process.env = { ...envSnapshot };
});

describe("InMemoryTourRepository (indexed)", () => {
  it("findById is O(1) lookup", async () => {
    const repo = new InMemoryTourRepository();
    const created = await repo.create({ tenantId: "t1", canonical: sampleCanonical });
    const found = await repo.findById(created.id);
    assert.equal(found?.id, created.id);
  });

  it("findMany scopes to tenant index", async () => {
    const repo = new InMemoryTourRepository();
    await repo.create({ tenantId: "t1", canonical: sampleCanonical });
    await repo.create({ tenantId: "t2", canonical: sampleCanonical });
    const t1 = await repo.findMany({ tenantId: "t1" });
    assert.equal(t1.length, 1);
    assert.equal(t1[0]?.tenantId, "t1");
  });

  it("rejects create when tenant cap exceeded", async () => {
    process.env.MAX_TOURS_PER_TENANT = "1";
    process.env.MAX_TOURS_GLOBAL = "100";
    const repo = new InMemoryTourRepository();
    await repo.create({ tenantId: "t1", canonical: sampleCanonical });
    await assert.rejects(
      () => repo.create({ tenantId: "t1", canonical: sampleCanonical }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, tourCapacityErrorMessage("TOUR_CAPACITY_TENANT"));
        return true;
      },
    );
  });
});
