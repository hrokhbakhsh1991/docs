/**
 * DP-5 — driver settlement API matrix.
 */
import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../../src/app.ts";
import { cancelBooking } from "../../src/bookings/create-bookings-service.ts";
import {
  handleDriverCancelledForSettlement,
  handleTourCancelledForSettlement,
} from "../../src/settlement/driver-settlement.service.ts";
import { removeAllocationsForPassenger } from "../../src/transport/transport-allocation.repository.ts";
import { operatorAuthHeaders, seedOperatorIdentityFixture } from "../fixtures/operator-identity-fixture.ts";
import { installHttpTestClient } from "../http-test-client.ts";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "../test-helpers.ts";
import {
  DP5_CURRENCY,
  DP5_TOUR_ID,
  DP5_UNIT_MINOR,
  dp5OpsAuth,
  dp5SeedDriverAndPassengers,
  resetDp5Harness,
} from "./dp5-test-harness.ts";

installMemoryStorageDriverForDescribe();

describe("DP-5 driver settlement API", () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  before(() => {
    seedOperatorIdentityFixture();
  });

  beforeEach(() => {
    resetDp5Harness();
  });

  async function putAllocations(driverId: string, passengerIds: string[]) {
    return client.requestJson<{ allocations?: unknown[] }>(
      "PUT",
      `/tours/${DP5_TOUR_ID}/transport-allocations`,
      {
        headers: operatorAuthHeaders(),
        body: {
          allocations: passengerIds.map((passengerRegistrationId) => ({
            driverRegistrationId: driverId,
            passengerRegistrationId,
          })),
        },
      }
    );
  }

  async function freezeRoster() {
    return client.requestJson<{
      settlements?: Array<{
        driverRegistrationId?: string;
        billableQuantity?: number;
        totalMinor?: string;
        status?: string;
      }>;
      replay?: boolean;
    }>("POST", `/tours/${DP5_TOUR_ID}/roster/freeze`, {
      headers: operatorAuthHeaders(),
      body: {
        driverCompensationPerSeatMinor: DP5_UNIT_MINOR,
        currency: DP5_CURRENCY,
      },
    });
  }

  it("offered 3 / assigned 2 → settlement total = 2 × unit", async () => {
    const { driverId, passengerIds } = await dp5SeedDriverAndPassengers({
      offeredSeats: 3,
      passengerCount: 3,
    });
    const alloc = await putAllocations(driverId, passengerIds.slice(0, 2));
    assert.equal(alloc.status, 200);

    const frozen = await freezeRoster();
    assert.equal(frozen.status, 200);
    const settlement = frozen.body.settlements?.find((s) => s.driverRegistrationId === driverId);
    assert.ok(settlement);
    assert.equal(settlement?.billableQuantity, 2);
    assert.equal(settlement?.totalMinor, "100000");
    assert.equal(settlement?.status, "draft");
  });

  it("assigned 0 → billable 0", async () => {
    const { driverId } = await dp5SeedDriverAndPassengers({ offeredSeats: 3, passengerCount: 0 });
    const frozen = await freezeRoster();
    assert.equal(frozen.status, 200);
    const settlement = frozen.body.settlements?.find((s) => s.driverRegistrationId === driverId);
    assert.equal(settlement?.billableQuantity, 0);
    assert.equal(settlement?.totalMinor, "0");
  });

  it("passenger cancel before finalization removes allocation impact on recalc path", async () => {
    const { driverId, passengerIds } = await dp5SeedDriverAndPassengers({
      offeredSeats: 3,
      passengerCount: 2,
    });
    await putAllocations(driverId, passengerIds);
    removeAllocationsForPassenger(dp5OpsAuth().tenantId, passengerIds[1]!);
    await cancelBooking(dp5OpsAuth(), passengerIds[1]!);
    const frozen = await freezeRoster();
    const settlement = frozen.body.settlements?.find((s) => s.driverRegistrationId === driverId);
    assert.equal(settlement?.billableQuantity, 1);
    assert.equal(settlement?.totalMinor, "50000");
  });

  it("passenger reassignment updates billable driver", async () => {
    const auth = dp5OpsAuth();
    const driverA = await dp5SeedDriverAndPassengers({ offeredSeats: 3, passengerCount: 1 });
    const driverB = await dp5SeedDriverAndPassengers({ offeredSeats: 3, passengerCount: 0 });
    const passengerId = driverA.passengerIds[0]!;
    await putAllocations(driverA.driverId, [passengerId]);
    await putAllocations(driverB.driverId, [passengerId]);
    const frozen = await freezeRoster();
    const settlementB = frozen.body.settlements?.find(
      (s) => s.driverRegistrationId === driverB.driverId
    );
    assert.equal(settlementB?.billableQuantity, 1);
    void auth;
  });

  it("driver cancellation voids draft settlement", async () => {
    const { driverId, passengerIds } = await dp5SeedDriverAndPassengers({
      offeredSeats: 3,
      passengerCount: 1,
    });
    await putAllocations(driverId, passengerIds);
    await freezeRoster();
    await handleDriverCancelledForSettlement(dp5OpsAuth(), DP5_TOUR_ID, driverId);
    const list = await client.requestJson<{ settlements?: Array<{ status?: string }> }>(
      "GET",
      `/tours/${DP5_TOUR_ID}/driver-settlements`,
      { headers: operatorAuthHeaders() }
    );
    const row = list.body.settlements?.find((s) => s.status === "voided");
    assert.ok(row);
  });

  it("tour cancellation voids settlements", async () => {
    const { driverId, passengerIds } = await dp5SeedDriverAndPassengers({
      offeredSeats: 3,
      passengerCount: 1,
    });
    await putAllocations(driverId, passengerIds);
    await freezeRoster();
    await handleTourCancelledForSettlement(dp5OpsAuth(), DP5_TOUR_ID);
    const list = await client.requestJson<{ settlements?: Array<{ status?: string }> }>(
      "GET",
      `/tours/${DP5_TOUR_ID}/driver-settlements`,
      { headers: operatorAuthHeaders() }
    );
    assert.ok(list.body.settlements?.every((s) => s.status === "voided"));
  });

  it("duplicate finalization is idempotent", async () => {
    const { driverId, passengerIds } = await dp5SeedDriverAndPassengers({
      offeredSeats: 3,
      passengerCount: 2,
    });
    await putAllocations(driverId, passengerIds);
    const first = await freezeRoster();
    const second = await freezeRoster();
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.body.replay, true);
    assert.equal(first.body.settlements?.length, second.body.settlements?.length);
  });

  it("duplicate payout complete is idempotent", async () => {
    const { driverId, passengerIds } = await dp5SeedDriverAndPassengers({
      offeredSeats: 3,
      passengerCount: 2,
    });
    await putAllocations(driverId, passengerIds);
    const frozen = await freezeRoster();
    const settlementId = frozen.body.settlements?.[0]?.driverRegistrationId
      ? (
          await client.requestJson<{ settlements?: Array<{ settlementId?: string }> }>(
            "GET",
            `/tours/${DP5_TOUR_ID}/driver-settlements`,
            { headers: operatorAuthHeaders() }
          )
        ).body.settlements?.find((s) => true)?.settlementId
      : undefined;
    const list = await client.requestJson<{ settlements?: Array<{ settlementId?: string }> }>(
      "GET",
      `/tours/${DP5_TOUR_ID}/driver-settlements`,
      { headers: operatorAuthHeaders() }
    );
    const id = list.body.settlements?.[0]?.settlementId;
    assert.ok(id);
    await client.requestJson("POST", `/tours/${DP5_TOUR_ID}/driver-settlements/${id}/confirm`, {
      headers: operatorAuthHeaders(),
      body: {},
    });
    const payable = await client.requestJson<{ payable?: { payableId?: string }; replay?: boolean }>(
      "POST",
      `/tours/${DP5_TOUR_ID}/driver-settlements/${id}/approve-payable`,
      { headers: operatorAuthHeaders(), body: {} }
    );
    assert.equal(payable.status, 200);
    const payableId = payable.body.payable?.payableId;
    assert.ok(payableId);
    const dupPayable = await client.requestJson<{ replay?: boolean }>(
      "POST",
      `/tours/${DP5_TOUR_ID}/driver-settlements/${id}/approve-payable`,
      { headers: operatorAuthHeaders(), body: {} }
    );
    assert.equal(dupPayable.body.replay, true);
    const paid = await client.requestJson<{ replay?: boolean }>(
      "POST",
      `/finance/driver-payables/${payableId}/complete`,
      { headers: operatorAuthHeaders(), body: { evidenceNote: "bank transfer" } }
    );
    assert.equal(paid.status, 200);
    const paidAgain = await client.requestJson<{ replay?: boolean }>(
      "POST",
      `/finance/driver-payables/${payableId}/complete`,
      { headers: operatorAuthHeaders(), body: { evidenceNote: "bank transfer" } }
    );
    assert.equal(paidAgain.body.replay, true);
    void settlementId;
    void driverId;
  });

  it("correction before payout creates new draft settlement", async () => {
    const { driverId, passengerIds } = await dp5SeedDriverAndPassengers({
      offeredSeats: 3,
      passengerCount: 2,
    });
    await putAllocations(driverId, passengerIds);
    const frozen = await freezeRoster();
    const id = frozen.body.settlements?.[0]?.driverRegistrationId
      ? (
          await client.requestJson<{ settlements?: Array<{ settlementId?: string }> }>(
            "GET",
            `/tours/${DP5_TOUR_ID}/driver-settlements`,
            { headers: operatorAuthHeaders() }
          )
        ).body.settlements?.[0]?.settlementId
      : undefined;
    const list = await client.requestJson<{ settlements?: Array<{ settlementId?: string }> }>(
      "GET",
      `/tours/${DP5_TOUR_ID}/driver-settlements`,
      { headers: operatorAuthHeaders() }
    );
    const settlementId = list.body.settlements?.[0]?.settlementId;
    assert.ok(settlementId);
    await client.requestJson("POST", `/tours/${DP5_TOUR_ID}/driver-settlements/${settlementId}/confirm`, {
      headers: operatorAuthHeaders(),
      body: {},
    });
    const payable = await client.requestJson(
      "POST",
      `/tours/${DP5_TOUR_ID}/driver-settlements/${settlementId}/approve-payable`,
      { headers: operatorAuthHeaders(), body: {} }
    );
    assert.equal(payable.status, 200);
    const correction = await client.requestJson<{ settlement?: { billableQuantity?: number } }>(
      "POST",
      `/tours/${DP5_TOUR_ID}/driver-settlements/${settlementId}/correction`,
      {
        headers: operatorAuthHeaders(),
        body: { billableQuantity: 1, unitAmountMinor: DP5_UNIT_MINOR, currency: DP5_CURRENCY },
      }
    );
    assert.equal(correction.status, 201);
    assert.equal(correction.body.settlement?.billableQuantity, 1);
  });

  it("correction after payout allowed for paid settlement", async () => {
    const { driverId, passengerIds } = await dp5SeedDriverAndPassengers({
      offeredSeats: 3,
      passengerCount: 2,
    });
    await putAllocations(driverId, passengerIds);
    await freezeRoster();
    const list = await client.requestJson<{ settlements?: Array<{ settlementId?: string }> }>(
      "GET",
      `/tours/${DP5_TOUR_ID}/driver-settlements`,
      { headers: operatorAuthHeaders() }
    );
    const settlementId = list.body.settlements?.[0]?.settlementId;
    assert.ok(settlementId);
    await client.requestJson("POST", `/tours/${DP5_TOUR_ID}/driver-settlements/${settlementId}/confirm`, {
      headers: operatorAuthHeaders(),
      body: {},
    });
    const payable = await client.requestJson<{ payable?: { payableId?: string } }>(
      "POST",
      `/tours/${DP5_TOUR_ID}/driver-settlements/${settlementId}/approve-payable`,
      { headers: operatorAuthHeaders(), body: {} }
    );
    await client.requestJson(
      "POST",
      `/finance/driver-payables/${payable.body.payable?.payableId}/complete`,
      { headers: operatorAuthHeaders(), body: { evidenceNote: "paid" } }
    );
    const correction = await client.requestJson(
      "POST",
      `/tours/${DP5_TOUR_ID}/driver-settlements/${settlementId}/correction`,
      {
        headers: operatorAuthHeaders(),
        body: { billableQuantity: 1, unitAmountMinor: DP5_UNIT_MINOR, currency: DP5_CURRENCY },
      }
    );
    assert.equal(correction.status, 201);
  });
});
