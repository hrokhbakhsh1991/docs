import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { resetTourExecutionRepositoryForTests } from "../src/storage/tour-execution/tour-execution.repository.factory";
import { dp5OpsAuth, dp5SeedDriverAndPassengers, resetDp5Harness, DP5_TOUR_ID } from "./dp5/dp5-test-harness";
import { operatorAuthHeaders, seedOperatorIdentityFixture } from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type Json = Record<string, unknown>;

describe("tour-execution HTTP — durable operational facts", () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  before(() => {
    seedOperatorIdentityFixture();
  });

  beforeEach(() => {
    resetDp5Harness();
    resetTourExecutionRepositoryForTests();
  });

  it("creates driver facts from approved personal-car registrations and is idempotent", async () => {
    const seeded = await dp5SeedDriverAndPassengers({ offeredSeats: 3, passengerCount: 2 });
    const first = await client.requestJson<Json>("POST", `/tours/${DP5_TOUR_ID}/execution/start`, {
      headers: operatorAuthHeaders(),
    });
    assert.equal(first.status, 201);
    assert.equal(first.body.replay, false);
    const firstSnapshot = first.body.snapshot as Json;
    assert.equal((firstSnapshot.execution as Json).status, "in_progress");
    const driverFacts = firstSnapshot.driverFacts as Json[];
    assert.equal(driverFacts.length, 1);
    assert.equal(driverFacts[0]?.driverRegistrationId, seeded.driverId);
    assert.equal(driverFacts[0]?.offeredPassengerCapacity, 3);
    assert.equal(driverFacts[0]?.actualPassengerCount, 0);

    const replay = await client.requestJson<Json>("POST", `/tours/${DP5_TOUR_ID}/execution/start`, {
      headers: operatorAuthHeaders(),
    });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replay, true);
  });

  it("validates capacity and stale writes, then completes without a financial side effect", async () => {
    const seeded = await dp5SeedDriverAndPassengers({ offeredSeats: 2 });
    const started = await client.requestJson<Json>("POST", `/tours/${DP5_TOUR_ID}/execution/start`, {
      headers: operatorAuthHeaders(),
    });
    assert.equal(started.status, 201);

    const overCapacity = await client.requestJson<Json>(
      "PATCH",
      `/tours/${DP5_TOUR_ID}/execution/drivers/${seeded.driverId}`,
      {
        headers: operatorAuthHeaders(),
        body: { expectedVersion: 1, actualPassengerCount: 3, attendanceStatus: "departed" },
      }
    );
    assert.equal(overCapacity.status, 422);
    assert.equal(overCapacity.body.code, "ATTENDANCE_CAPACITY_EXCEEDED");

    const updated = await client.requestJson<Json>(
      "PATCH",
      `/tours/${DP5_TOUR_ID}/execution/drivers/${seeded.driverId}`,
      {
        headers: operatorAuthHeaders(),
        body: {
          expectedVersion: 1,
          actualPassengerCount: 2,
          attendanceStatus: "departed",
          reason: "final pickup count",
        },
      }
    );
    assert.equal(updated.status, 200);
    assert.equal((updated.body.fact as Json).version, 2);
    assert.equal((updated.body.fact as Json).actualPassengerCount, 2);

    const stale = await client.requestJson<Json>(
      "PATCH",
      `/tours/${DP5_TOUR_ID}/execution/drivers/${seeded.driverId}`,
      {
        headers: operatorAuthHeaders(),
        body: { expectedVersion: 1, actualPassengerCount: 1, attendanceStatus: "present" },
      }
    );
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "STALE_EXECUTION_VERSION");

    const completed = await client.requestJson<Json>("POST", `/tours/${DP5_TOUR_ID}/execution/complete`, {
      headers: operatorAuthHeaders(),
    });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.replay, false);
    assert.equal((completed.body.execution as Json).status, "completed");

    const afterComplete = await client.requestJson<Json>(
      "PATCH",
      `/tours/${DP5_TOUR_ID}/execution/drivers/${seeded.driverId}`,
      {
        headers: operatorAuthHeaders(),
        body: { expectedVersion: 2, actualPassengerCount: 1, attendanceStatus: "present" },
      }
    );
    assert.equal(afterComplete.status, 409);
    assert.equal(afterComplete.body.code, "TOUR_EXECUTION_NOT_EDITABLE");
  });

  it("does not expose another tenant's execution", async () => {
    await dp5SeedDriverAndPassengers();
    const start = await client.requestJson<Json>("POST", `/tours/${DP5_TOUR_ID}/execution/start`, {
      headers: operatorAuthHeaders(),
    });
    assert.equal(start.status, 201);
    const otherTenantId = "00000000-0000-4000-8000-000000000099";
    const foreign = await client.requestJson<Json>("GET", `/tours/${DP5_TOUR_ID}/execution`, {
      headers: {
        ...operatorAuthHeaders(),
        "x-tenant-id": otherTenantId,
        "x-authenticated-tenant-id": otherTenantId,
        "x-workspace-id": "ws-other-tenant",
      },
    });
    assert.equal(foreign.status, 404);
    assert.match(String(foreign.body.code ?? foreign.body.error), /TENANT|WORKSPACE|NOT_FOUND/i);

    const ownerSnapshot = await client.requestJson<Json>("GET", `/tours/${DP5_TOUR_ID}/execution`, {
      headers: operatorAuthHeaders(),
    });
    assert.equal(ownerSnapshot.status, 200);
    assert.equal((ownerSnapshot.body.execution as Json).tenantId, dp5OpsAuth().tenantId);
  });
});
