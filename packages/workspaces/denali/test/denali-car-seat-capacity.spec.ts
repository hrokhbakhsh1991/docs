import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliBookingCreatePolicyContext,
  evaluateDenaliCapacityRelease,
  evaluateDenaliCreateCapacity,
} from "../src/booking";
import { normalizeDenaliRegistrationTransportIntake } from "../src/http/resolve-denali-registration-transport";

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
  it("applies the tour-wide capacity limit across every supported transport mode", () => {
    const modes = ["organizer_vehicle", "bus", "minibus", "train", "shared_cars", "none"] as const;

    for (const mode of modes) {
      const registrationTransport = normalizeDenaliRegistrationTransportIntake(
        mode === "shared_cars" ? { kind: "no_car_acquaintance" } : undefined,
        { transport: { mode, dongAmount: mode === "shared_cars" ? 50_000 : undefined } }
      );
      const evaluateOccupancy = (occupiedApprovedPartySize: number) => {
        const context = buildDenaliBookingCreatePolicyContext({
          tenantId: "denali-test",
          tourId: `tour-test-${mode}`,
          tourTitle: "Capacity test",
          guestLabel: "Test guest",
          partySize: 1,
          departureAt: "2031-08-01T10:00:00.000Z",
          occupiedApprovedPartySize,
          tourCapacityMax: 2,
          registrationIntake: { transport: registrationTransport },
          approvedCapacitySnapshots: [],
        });
        return evaluateDenaliCreateCapacity(context);
      };

      assert.equal(evaluateOccupancy(1).decision, "accept", `${mode} should accept the last seat`);
      assert.equal(evaluateOccupancy(2).decision, "deny", `${mode} should reject over-capacity`);
      assert.equal(evaluateOccupancy(1).availability?.tourCapacityMax, 2);
    }
  });

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

  it("allows driver removal when the remaining cars still cover every assigned dong seat", () => {
    const cases = [
      {
        name: "one reassigned rider fits in the replacement car",
        snapshots: [driver(1), dongPassenger()],
        allowed: true,
      },
      {
        name: "two riders cannot fit in one remaining seat",
        snapshots: [driver(1), dongPassenger(2)],
        allowed: false,
      },
      {
        name: "a driver with no remaining car cannot leave a rider assigned",
        snapshots: [dongPassenger()],
        allowed: false,
      },
      {
        name: "a driver with no assigned riders can be removed",
        snapshots: [],
        allowed: true,
      },
    ] as const;

    for (const scenario of cases) {
      const result = evaluateDenaliCapacityRelease({
        bookingStatus: "approved",
        booking: driver(1),
        approvedCapacitySnapshots: scenario.snapshots,
      });
      assert.equal(result.allowed, scenario.allowed, scenario.name);
    }
  });
});
