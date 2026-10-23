import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createTourStorageRepository } from "../../storage/create-tour-storage.ts";
import { HostBookingTourCapacityAdapter } from "./host-booking-tour-capacity.adapter.ts";

const tenantId = "00000000-0000-4000-8000-000000000014";
const previousStorageDriver = process.env.STORAGE_DRIVER;

describe("HostBookingTourCapacityAdapter compensation", () => {
  before(() => {
    process.env.NODE_ENV = "test";
    process.env.STORAGE_DRIVER = "memory";
  });

  after(() => {
    if (previousStorageDriver === undefined) delete process.env.STORAGE_DRIVER;
    else process.env.STORAGE_DRIVER = previousStorageDriver;
  });

  it("restores only the expected expansion and preserves unrelated canonical data", async () => {
    const tours = createTourStorageRepository();
    const created = await tours.createTour({
      tenantId,
      canonical: {
        schemaVersion: 1,
        roots: ["basics"],
        data: { title: "Capacity compensation", capacityMax: 5, description: "preserve me" },
      },
    });
    const adapter = new HostBookingTourCapacityAdapter();

    const expansion = await adapter.increaseTourCapacity({
      tenantId,
      tourId: created.id,
      delta: 2,
    });
    assert.deepEqual(expansion, { previousCapacity: 5, nextCapacity: 7 });

    assert.equal(
      await adapter.restoreTourCapacityIfUnchanged({
        tenantId,
        tourId: created.id,
        expectedCapacity: 6,
        restoreCapacity: 5,
      }),
      false,
      "a stale compensation must not overwrite a different capacity"
    );
    assert.equal(await adapter.resolveTourCapacityMax(tenantId, created.id), 7);

    assert.equal(
      await adapter.restoreTourCapacityIfUnchanged({
        tenantId,
        tourId: created.id,
        expectedCapacity: 7,
        restoreCapacity: 5,
      }),
      true
    );
    assert.equal(await adapter.resolveTourCapacityMax(tenantId, created.id), 5);
    const restored = await tours.getById(created.id, tenantId);
    assert.equal(restored?.canonical.data.description, "preserve me");
    assert.equal(restored?.rowVersion, created.rowVersion + 2);
  });
});
