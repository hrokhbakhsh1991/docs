import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliBookingCreatePolicyContext,
  evaluateDenaliCreateCapacity,
} from "../src/booking";

const driver = (seats: number) => ({
  partySize: 1,
  registrationIntake: { transport: { kind: "personal_car", personalCarOccupants: seats } },
});
const dongPassenger = (partySize = 1) => ({
  partySize,
  registrationIntake: { transport: { kind: "no_car_dong" } },
});

function evaluate(input: {
  partySize?: number;
  candidateKind: "no_car_dong" | "no_car_acquaintance" | "personal_car" | "bus";
  occupied: number;
  snapshots: ReturnType<typeof driver>[] | ReturnType<typeof dongPassenger>[];
}) {
  const ctx = buildDenaliBookingCreatePolicyContext({
    tenantId: "denali-test",
    tourId: "tour-test",
    tourTitle: "Capacity test",
    guestLabel: "Test guest",
    partySize: input.partySize ?? 1,
    departureAt: "2031-08-01T10:00:00.000Z",
    occupiedApprovedPartySize: input.occupied,
    tourCapacityMax: 10,
    registrationIntake: { transport: { kind: input.candidateKind } },
    approvedCapacitySnapshots: input.snapshots,
  });
  return evaluateDenaliCreateCapacity(ctx);
}

describe("Denali personal-car seat capacity", () => {
  it("accepts dong riders up to the offered seats and denies the next seat", () => {
    const snapshots = [
      driver(2),
      driver(1),
      driver(1),
      driver(1),
      ...Array.from({ length: 4 }, () => dongPassenger()),
    ];
    assert.equal(
      evaluate({ candidateKind: "no_car_dong", occupied: 8, snapshots }).decision,
      "accept"
    );
    const full = evaluate({
      candidateKind: "no_car_dong",
      occupied: 9,
      snapshots: [...snapshots, dongPassenger()],
    });
    assert.equal(full.decision, "deny");
    assert.match(full.reasonCode ?? "", /^BOOKING_TRANSPORT_CAPACITY_REJECTED:/);
  });

  it("never splits a group across the remaining car seats", () => {
    const result = evaluate({
      candidateKind: "no_car_dong",
      partySize: 2,
      occupied: 8,
      snapshots: [driver(2), ...Array.from({ length: 3 }, () => dongPassenger())],
    });
    assert.equal(result.decision, "deny");
    assert.match(result.reasonCode ?? "", /dongSeatsRequired=5 carSeatsOffered=2/);
  });

  it("does not consume car seats for self-arrival or fixed transport", () => {
    const snapshots = [driver(0)];
    assert.equal(
      evaluate({ candidateKind: "no_car_acquaintance", occupied: 1, snapshots }).decision,
      "accept"
    );
    assert.equal(evaluate({ candidateKind: "bus", occupied: 1, snapshots }).decision, "accept");
  });

  it("fails closed if existing dong demand already exceeds offered seats", () => {
    const result = evaluate({
      candidateKind: "no_car_acquaintance",
      occupied: 4,
      snapshots: [driver(1), dongPassenger(2), dongPassenger(1)],
    });
    assert.equal(result.decision, "deny");
    assert.match(result.reasonCode ?? "", /dongSeatsRequired=3 carSeatsOffered=1/);
  });
});
