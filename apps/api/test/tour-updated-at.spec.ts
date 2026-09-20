import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";

describe("tour updatedAt propagation", () => {
  it("keeps the persisted mutation timestamp separate from createdAt", async () => {
    const store = new InMemoryTourRepository();
    const adapter = new TourStorageDbAdapter(store);
    const created = await store.createTour({
      tenantId: "tenant-updated-at",
      canonical: { schemaVersion: 1, data: { title: "Timestamp test" } },
    });

    assert.equal(created.updatedAt, created.createdAt);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await store.updateIfRowVersion({
      tenantId: created.tenantId,
      id: created.id,
      canonical: { schemaVersion: 1, data: { title: "Timestamp test updated" } },
      expectedRowVersion: created.rowVersion,
    });
    assert.notEqual(updated.updatedAt, created.updatedAt);

    const record = await adapter.findFirst({ tenantId: created.tenantId, id: created.id });
    assert.equal(record?.updatedAt, updated.updatedAt);
  });
});
