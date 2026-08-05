import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { emptyWorkspaceIntegrationsListResponse } from "./integrations.service";

const previousStorageDriver = process.env.STORAGE_DRIVER;

afterEach(() => {
  if (previousStorageDriver === undefined) {
    delete process.env.STORAGE_DRIVER;
  } else {
    process.env.STORAGE_DRIVER = previousStorageDriver;
  }
});

describe("integrations memory-storage read contract", () => {
  it("returns a valid inactive list without requiring Prisma persistence", () => {
    const response = emptyWorkspaceIntegrationsListResponse();

    assert.deepEqual(response.items, []);
    assert.equal(response.summary.integrationConnectionCount, 0);
    assert.equal(response.summary.legacyConnectionCount, 0);
    assert.equal(response.summary.activeDeliverySource, null);
  });
});
