import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { approveBooking, createBooking } from "../../src/bookings/create-bookings-service.ts";
import {
  findSettlementByIdempotencyKey,
  insertSettlement,
  listSettlementsForTour,
  resetDriverSettlementStoreForTests,
} from "../../src/settlement/driver-settlement.repository.ts";
import { freezeTourRosterAndGenerateSettlements } from "../../src/settlement/driver-settlement.service.ts";
import {
  DP1_TENANT_DENALI,
  DP1_TOUR_ID,
  dp1BookingBody,
  dp1OpsAuth,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";

describe("DP1 driver settlement freeze recovery", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => {
    resetDp1MemoryHarness();
    resetDriverSettlementStoreForTests();
  });
  after(() => {
    resetDp1MemoryHarness();
    resetDriverSettlementStoreForTests();
  });

  it("replays a frozen snapshot and repairs settlements missing after a partial commit", async () => {
    const auth = dp1OpsAuth();
    const drivers = await Promise.all(
      ["A", "B"].map(async (suffix) => {
        const booking = await createBooking(
          auth,
          dp1BookingBody({
            guestLabel: `DP1 Settlement Driver ${suffix}`,
            partySize: 1,
            tourCapacityMax: 10,
            registrationIntake: {
              transport: { kind: "personal_car", personalCarOccupants: 2 },
            },
          })
        );
        await approveBooking(auth, booking.id);
        return booking.id;
      })
    );

    const input = { driverCompensationPerSeatMinor: "250000", currency: "IRR" };
    const first = await freezeTourRosterAndGenerateSettlements(auth, DP1_TOUR_ID, input);
    assert.equal(first.settlements.length, 2);
    assert.deepEqual(
      new Set(first.settlements.map((settlement) => settlement.driverRegistrationId)),
      new Set(drivers)
    );

    // Simulate a process failure after one settlement row committed. Keep the
    // durable roster freeze and one idempotent settlement, then retry.
    const committed = first.settlements[0]!;
    resetDriverSettlementStoreForTests();
    insertSettlement(committed);

    const retried = await freezeTourRosterAndGenerateSettlements(auth, DP1_TOUR_ID, {
      driverCompensationPerSeatMinor: "999999",
      currency: "USD",
    });
    assert.equal(retried.replay, true);
    assert.equal(retried.settlements.length, 2);
    assert.deepEqual(
      new Set(retried.settlements.map((settlement) => settlement.driverRegistrationId)),
      new Set(drivers)
    );
    assert.equal(
      retried.settlements.find(
        (settlement) => settlement.driverRegistrationId === committed.driverRegistrationId
      )?.settlementId,
      committed.settlementId,
      "retry must reuse the already committed idempotent settlement"
    );
    assert.equal(
      findSettlementByIdempotencyKey(DP1_TENANT_DENALI, retried.settlements[1]!.idempotencyKey),
      retried.settlements[1]
    );
    assert.ok(
      retried.settlements.every(
        (settlement) =>
          settlement.unitAmountMinor === input.driverCompensationPerSeatMinor &&
          settlement.currency === input.currency
      ),
      "a retry must use the compensation terms captured by the roster freeze"
    );
    assert.equal(listSettlementsForTour(DP1_TENANT_DENALI, DP1_TOUR_ID).length, 2);

    const replay = await freezeTourRosterAndGenerateSettlements(auth, DP1_TOUR_ID, input);
    assert.equal(replay.settlements.length, 2);
    assert.deepEqual(
      new Set(replay.settlements.map((settlement) => settlement.settlementId)),
      new Set(retried.settlements.map((settlement) => settlement.settlementId))
    );
    assert.equal(listSettlementsForTour(DP1_TENANT_DENALI, DP1_TOUR_ID).length, 2);
  });
});
