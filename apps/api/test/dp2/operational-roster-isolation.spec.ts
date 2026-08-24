/**
 * DP-2 workspace isolation — roster never leaks cross-tenant registration IDs.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app.ts";
import { operatorAuthHeaders } from "../fixtures/operator-identity-fixture.ts";
import { installHttpTestClient } from "../http-test-client.ts";
import {
  createSharedMemoryTourStoreForHttpTests,
  createTestToursService,
  installMemoryStorageDriverForDescribe,
} from "../test-helpers.ts";
import {
  DP1_TOUR_ID,
  dp1CreateAndApprovePending,
  resetDp1MemoryHarness,
} from "../dp1/dp1-test-harness.ts";

installMemoryStorageDriverForDescribe();

const OTHER_TENANT = "00000000-0000-4000-8000-000099";

describe("DP-2 operational roster isolation", () => {
  const client = installHttpTestClient(() => {
    const repo = createSharedMemoryTourStoreForHttpTests();
    return createRequestListener({ toursService: createTestToursService(repo), tourStore: repo });
  });

  before(() => {
    resetDp1MemoryHarness();
  });

  it("does not return Denali tenant registrations when queried under another tenant header", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();

    const response = await client.requestJson<{
      items?: Array<{ registrationId?: string; tourId?: string }>;
    }>("GET", `/tours/${DP1_TOUR_ID}/operational-roster?filter=operational`, {
      headers: {
        ...operatorAuthHeaders(),
        "x-tenant-id": OTHER_TENANT,
      },
    });

    assert.equal(response.status, 403);
  });
});
