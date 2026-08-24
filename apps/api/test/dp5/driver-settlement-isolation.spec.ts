/**
 * DP-5 — workspace isolation for driver settlement.
 */
import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../../src/app.ts";
import { OPERATOR_SMOKE } from "../fixtures/operator-smoke-e2e-tenant.ts";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "../fixtures/operator-identity-fixture.ts";
import { installHttpTestClient } from "../http-test-client.ts";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "../test-helpers.ts";
import { DP5_TOUR_ID, dp5SeedDriverAndPassengers, resetDp5Harness } from "./dp5-test-harness.ts";

installMemoryStorageDriverForDescribe();

const OTHER_TENANT = "00000000-0000-4000-8000-000000000099";

describe("DP-5 driver settlement isolation", () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  before(() => {
    seedOperatorIdentityFixture();
  });

  beforeEach(() => {
    resetDp5Harness();
  });

  it("cross-tenant cannot read settlements", async () => {
    const { driverId, passengerIds } = await dp5SeedDriverAndPassengers({
      offeredSeats: 3,
      passengerCount: 1,
    });
    await client.requestJson("PUT", `/tours/${DP5_TOUR_ID}/transport-allocations`, {
      headers: operatorAuthHeaders(),
      body: {
        allocations: [
          { driverRegistrationId: driverId, passengerRegistrationId: passengerIds[0] },
        ],
      },
    });
    await client.requestJson("POST", `/tours/${DP5_TOUR_ID}/roster/freeze`, {
      headers: operatorAuthHeaders(),
      body: { driverCompensationPerSeatMinor: "50000", currency: "IRR" },
    });

    const otherTenantHeaders = {
      ...operatorAuthHeaders(),
      "x-tenant-id": OTHER_TENANT,
    };
    const response = await client.requestJson<{ settlements?: unknown[] }>(
      "GET",
      `/tours/${DP5_TOUR_ID}/driver-settlements`,
      { headers: otherTenantHeaders }
    );
    assert.ok(
      response.status === 403 || (response.status === 200 && (response.body.settlements?.length ?? 0) === 0),
      "cross-tenant must not see settlements"
    );
  });
});
