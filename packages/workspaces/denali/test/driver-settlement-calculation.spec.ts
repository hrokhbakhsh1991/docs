/**
 * DP-5 — driver settlement domain tests (test-first).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSettlementIdempotencyKey,
  calculateDriverSettlement,
  canMutateSettlementFacts,
  isDriverSettlementTransitionAllowed,
  isSettlementImmutable,
} from "../src/settlement/index.ts";
import {
  countAssignedPassengers,
  validateTransportAllocations,
  type RosterParticipant,
  type TransportAllocationInput,
} from "../src/transport/index.ts";

const DRIVER_ID = "driver-reg-1";
const PASSENGER_A = "passenger-a";
const PASSENGER_B = "passenger-b";
const PASSENGER_C = "passenger-c";

function driverParticipant(over: Partial<RosterParticipant> = {}): RosterParticipant {
  return {
    registrationId: DRIVER_ID,
    status: "approved",
    transportKind: "personal_car",
    personalCarOccupants: 3,
    ...over,
  };
}

function passenger(id: string): RosterParticipant {
  return {
    registrationId: id,
    status: "approved",
    transportKind: "primary",
    personalCarOccupants: null,
  };
}

function participantsForScenario(): RosterParticipant[] {
  return [driverParticipant(), passenger(PASSENGER_A), passenger(PASSENGER_B), passenger(PASSENGER_C)];
}

describe("DP-5 driver settlement calculation", () => {
  it("offered 3 / assigned 2 → billable 2, total = 2 × unit", () => {
    const result = calculateDriverSettlement({
      offeredSeats: 3,
      assignedPassengers: 2,
      unitAmountMinor: "50000",
      currency: "IRR",
    });
    assert.equal(result.billableQuantity, 2);
    assert.equal(result.totalMinor, "100000");
  });

  it("assigned 0 → billable 0, total 0", () => {
    const result = calculateDriverSettlement({
      offeredSeats: 3,
      assignedPassengers: 0,
      unitAmountMinor: "50000",
      currency: "IRR",
    });
    assert.equal(result.billableQuantity, 0);
    assert.equal(result.totalMinor, "0");
  });

  it("assigned exceeds offered → capped at offered", () => {
    const result = calculateDriverSettlement({
      offeredSeats: 2,
      assignedPassengers: 5,
      unitAmountMinor: "1000",
      currency: "IRR",
    });
    assert.equal(result.billableQuantity, 2);
    assert.equal(result.totalMinor, "2000");
  });
});

describe("DP-5 transport allocation validation", () => {
  const tourId = "tour-1";

  it("rejects capacity exceeded", () => {
    const allocations: TransportAllocationInput[] = [
      { driverRegistrationId: DRIVER_ID, passengerRegistrationId: PASSENGER_A },
      { driverRegistrationId: DRIVER_ID, passengerRegistrationId: PASSENGER_B },
      { driverRegistrationId: DRIVER_ID, passengerRegistrationId: PASSENGER_C },
      { driverRegistrationId: DRIVER_ID, passengerRegistrationId: "passenger-d" },
    ];
    const result = validateTransportAllocations({
      tourId,
      allocations,
      participants: [...participantsForScenario(), passenger("passenger-d")],
      rosterFrozen: false,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "CAPACITY_EXCEEDED");
    }
  });

  it("rejects duplicate passenger assignment", () => {
    const allocations: TransportAllocationInput[] = [
      { driverRegistrationId: DRIVER_ID, passengerRegistrationId: PASSENGER_A },
      { driverRegistrationId: DRIVER_ID, passengerRegistrationId: PASSENGER_A },
    ];
    const result = validateTransportAllocations({
      tourId,
      allocations,
      participants: participantsForScenario(),
      rosterFrozen: false,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "DUPLICATE_PASSENGER");
    }
  });

  it("blocks changes when roster frozen", () => {
    const result = validateTransportAllocations({
      tourId,
      allocations: [],
      participants: participantsForScenario(),
      rosterFrozen: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "ROSTER_FROZEN");
    }
  });

  it("counts assigned passengers per driver", () => {
    const allocations: TransportAllocationInput[] = [
      { driverRegistrationId: DRIVER_ID, passengerRegistrationId: PASSENGER_A },
      { driverRegistrationId: DRIVER_ID, passengerRegistrationId: PASSENGER_B },
    ];
    assert.equal(countAssignedPassengers(allocations, DRIVER_ID), 2);
  });
});

describe("DP-5 settlement lifecycle", () => {
  it("draft → confirmed → payable → paid allowed", () => {
    assert.equal(isDriverSettlementTransitionAllowed("draft", "confirmed"), true);
    assert.equal(isDriverSettlementTransitionAllowed("confirmed", "payable"), true);
    assert.equal(isDriverSettlementTransitionAllowed("payable", "paid"), true);
  });

  it("paid is immutable", () => {
    assert.equal(isSettlementImmutable("paid"), true);
    assert.equal(canMutateSettlementFacts("paid"), false);
    assert.equal(isDriverSettlementTransitionAllowed("paid", "voided"), false);
  });

  it("draft can void", () => {
    assert.equal(isDriverSettlementTransitionAllowed("draft", "voided"), true);
  });

  it("idempotency key is stable per freeze", () => {
    const key = buildSettlementIdempotencyKey({
      tourId: "tour-1",
      driverRegistrationId: DRIVER_ID,
      rosterFrozenAt: "2031-08-01T12:00:00.000Z",
    });
    assert.equal(key, "settlement:tour-1:driver-reg-1:2031-08-01T12:00:00.000Z:none");
  });
});

describe("DP-5 scenario matrix (domain)", () => {
  it("passenger cancel before finalization → fewer assigned", () => {
    const allocations: TransportAllocationInput[] = [
      { driverRegistrationId: DRIVER_ID, passengerRegistrationId: PASSENGER_A },
      { driverRegistrationId: DRIVER_ID, passengerRegistrationId: PASSENGER_B },
    ];
    const afterCancel = allocations.filter((a) => a.passengerRegistrationId !== PASSENGER_B);
    const calc = calculateDriverSettlement({
      offeredSeats: 3,
      assignedPassengers: countAssignedPassengers(afterCancel, DRIVER_ID),
      unitAmountMinor: "50000",
      currency: "IRR",
    });
    assert.equal(calc.billableQuantity, 1);
    assert.equal(calc.totalMinor, "50000");
  });

  it("passenger reassignment moves count between drivers", () => {
    const driver2 = "driver-reg-2";
    const allocations: TransportAllocationInput[] = [
      { driverRegistrationId: DRIVER_ID, passengerRegistrationId: PASSENGER_A },
      { driverRegistrationId: driver2, passengerRegistrationId: PASSENGER_B },
    ];
    assert.equal(countAssignedPassengers(allocations, DRIVER_ID), 1);
    assert.equal(countAssignedPassengers(allocations, driver2), 1);
  });

  it("correction uses distinct idempotency key", () => {
    const base = buildSettlementIdempotencyKey({
      tourId: "tour-1",
      driverRegistrationId: DRIVER_ID,
      rosterFrozenAt: "2031-08-01T12:00:00.000Z",
    });
    const correction = buildSettlementIdempotencyKey({
      tourId: "tour-1",
      driverRegistrationId: DRIVER_ID,
      rosterFrozenAt: "2031-08-01T12:00:00.000Z",
      correctionOfSettlementId: "settlement-old",
    });
    assert.notEqual(base, correction);
  });
});
