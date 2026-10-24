import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";

import { buildDenaliBookingCreatePolicyContext, evaluateDenaliCreateCapacity } from "../src/booking";
import {
  countAssignedPassengers,
  validateTransportAllocations,
} from "../src/transport/validate-transport-allocation";

const transportKind = fc.constantFrom(
  "personal_car",
  "no_car_dong",
  "no_car_acquaintance",
  "bus"
);

type AllocationModel = {
  driverSeats: number[];
  passengerPartySizes: number[];
  assignments: Map<number, number>;
  frozen: boolean;
};

type AllocationSystem = {
  participants: Array<{
    registrationId: string;
    status: string;
    transportKind: string;
    personalCarOccupants: number | null;
    partySize?: number;
  }>;
  allocations: Array<{ driverRegistrationId: string; passengerRegistrationId: string }>;
  frozen: boolean;
};

function assertAllocationState(model: Readonly<AllocationModel>, real: AllocationSystem) {
  assert.equal(real.allocations.length, model.assignments.size);
  for (let driverIndex = 0; driverIndex < model.driverSeats.length; driverIndex += 1) {
    const expectedCount = [...model.assignments.entries()].reduce(
      (sum, [passengerIndex, assignedDriver]) =>
        sum +
        (assignedDriver === driverIndex ? model.passengerPartySizes[passengerIndex]! : 0),
      0
    );
    const actualCount = countAssignedPassengers(
      real.allocations,
      `driver-${driverIndex}`,
      real.participants
    );
    assert.equal(actualCount, expectedCount);
    assert.ok(actualCount <= model.driverSeats[driverIndex]!);
  }
}

class AddDriver implements fc.Command<AllocationModel, AllocationSystem> {
  constructor(private readonly seats: number) {}
  check(model: Readonly<AllocationModel>) {
    return !model.frozen && model.driverSeats.length < 4;
  }
  run(model: AllocationModel, real: AllocationSystem) {
    const index = model.driverSeats.length;
    model.driverSeats.push(this.seats);
    real.participants.push({
      registrationId: `driver-${index}`,
      status: "approved",
      transportKind: "personal_car",
      personalCarOccupants: this.seats,
      partySize: 1,
    });
    assertAllocationState(model, real);
  }
  toString() {
    return `addDriver(seats=${this.seats})`;
  }
}

class AddPassenger implements fc.Command<AllocationModel, AllocationSystem> {
  constructor(private readonly partySize: number) {}
  check(model: Readonly<AllocationModel>) {
    return !model.frozen && model.passengerPartySizes.length < 8;
  }
  run(model: AllocationModel, real: AllocationSystem) {
    const index = model.passengerPartySizes.length;
    model.passengerPartySizes.push(this.partySize);
    real.participants.push({
      registrationId: `passenger-${index}`,
      status: "approved",
      transportKind: "no_car_dong",
      personalCarOccupants: null,
      partySize: this.partySize,
    });
    assertAllocationState(model, real);
  }
  toString() {
    return `addPassenger(party=${this.partySize})`;
  }
}

class AssignPassenger implements fc.Command<AllocationModel, AllocationSystem> {
  constructor(
    private readonly driverPosition: number,
    private readonly passengerPosition: number
  ) {}
  check(model: Readonly<AllocationModel>) {
    return (
      !model.frozen && model.driverSeats.length > 0 && model.passengerPartySizes.length > 0
    );
  }
  run(model: AllocationModel, real: AllocationSystem) {
    const driverIndex = this.driverPosition % model.driverSeats.length;
    const passengerIndex = this.passengerPosition % model.passengerPartySizes.length;
    const driverRegistrationId = `driver-${driverIndex}`;
    const passengerRegistrationId = `passenger-${passengerIndex}`;
    const duplicate = model.assignments.has(passengerIndex);
    const alreadyAssigned = [...model.assignments.entries()].reduce(
      (sum, [assignedPassenger, assignedDriver]) =>
        sum +
        (assignedDriver === driverIndex
          ? model.passengerPartySizes[assignedPassenger]!
          : 0),
      0
    );
    const exceedsSeats =
      alreadyAssigned + model.passengerPartySizes[passengerIndex]! >
      model.driverSeats[driverIndex]!;
    const expectedAccept = !duplicate && !exceedsSeats;
    const candidate = { driverRegistrationId, passengerRegistrationId };
    const result = validateTransportAllocations({
      tourId: "model-test",
      participants: real.participants,
      allocations: [...real.allocations, candidate],
      rosterFrozen: real.frozen,
    });

    assert.equal(result.ok, expectedAccept, this.toString());
    if (expectedAccept) {
      model.assignments.set(passengerIndex, driverIndex);
      real.allocations.push(candidate);
    } else if (!result.ok) {
      assert.equal(result.code, duplicate ? "DUPLICATE_PASSENGER" : "CAPACITY_EXCEEDED");
    }
    assertAllocationState(model, real);
  }
  toString() {
    return `assign(driver#${this.driverPosition}, passenger#${this.passengerPosition})`;
  }
}

class UnassignPassenger implements fc.Command<AllocationModel, AllocationSystem> {
  constructor(private readonly position: number) {}
  check(model: Readonly<AllocationModel>) {
    return !model.frozen && model.assignments.size > 0;
  }
  run(model: AllocationModel, real: AllocationSystem) {
    const passengerIndex = [...model.assignments.keys()][this.position % model.assignments.size]!;
    const passengerRegistrationId = `passenger-${passengerIndex}`;
    model.assignments.delete(passengerIndex);
    real.allocations = real.allocations.filter(
      (allocation) => allocation.passengerRegistrationId !== passengerRegistrationId
    );
    assertAllocationState(model, real);
  }
  toString() {
    return `unassign(passenger#${this.position})`;
  }
}

class FreezeRoster implements fc.Command<AllocationModel, AllocationSystem> {
  check(model: Readonly<AllocationModel>) {
    return !model.frozen;
  }
  run(model: AllocationModel, real: AllocationSystem) {
    model.frozen = true;
    real.frozen = true;
    assertAllocationState(model, real);
  }
  toString() {
    return "freezeRoster";
  }
}

class AttemptFrozenChange implements fc.Command<AllocationModel, AllocationSystem> {
  check(model: Readonly<AllocationModel>) {
    return model.frozen && model.driverSeats.length > 0 && model.passengerPartySizes.length > 0;
  }
  run(_model: AllocationModel, real: AllocationSystem) {
    const result = validateTransportAllocations({
      tourId: "model-test",
      participants: real.participants,
      allocations: real.allocations,
      rosterFrozen: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "ROSTER_FROZEN");
    assert.equal(real.allocations.length, _model.assignments.size);
  }
  toString() {
    return "attemptMutationAfterFreeze";
  }
}

describe("Denali capacity properties", () => {
  it("matches tour-seat and shared-car-seat ledgers for generated registration combinations", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 40 }),
        fc.integer({ min: 1, max: 6 }),
        transportKind,
        fc.array(
          fc.record({
            kind: transportKind,
            partySize: fc.integer({ min: 1, max: 5 }),
            offeredSeats: fc.integer({ min: 0, max: 8 }),
          }),
          { maxLength: 12 }
        ),
        fc.integer({ min: 0, max: 12 }),
        (capacityMax, candidatePartySize, candidateKind, existing, unrelatedOccupancy) => {
          const occupied = existing.reduce((sum, registration) => sum + registration.partySize, 0)
            + unrelatedOccupancy;
          const offeredCarSeats = existing.reduce(
            (sum, registration) =>
              sum + (registration.kind === "personal_car" ? registration.offeredSeats : 0),
            0
          );
          const currentDongDemand = existing.reduce(
            (sum, registration) =>
              sum + (registration.kind === "no_car_dong" ? registration.partySize : 0),
            0
          );
          const expectedAccept =
            occupied + candidatePartySize <= capacityMax &&
            currentDongDemand + (candidateKind === "no_car_dong" ? candidatePartySize : 0) <=
              offeredCarSeats;

          const snapshots = existing.map((registration) => ({
            partySize: registration.partySize,
            registrationIntake: {
              transport: {
                kind: registration.kind,
                personalCarOccupants:
                  registration.kind === "personal_car" ? registration.offeredSeats : null,
              },
            },
          }));
          const context = buildDenaliBookingCreatePolicyContext({
            tenantId: "denali-property-test",
            tourId: "capacity-property-test",
            tourTitle: "Capacity property test",
            guestLabel: "Generated guest",
            partySize: candidatePartySize,
            departureAt: "2031-08-01T10:00:00.000Z",
            occupiedApprovedPartySize: occupied,
            tourCapacityMax: capacityMax,
            registrationIntake: { transport: { kind: candidateKind } },
            approvedCapacitySnapshots: snapshots,
          });

          assert.equal(
            evaluateDenaliCreateCapacity(context).decision,
            expectedAccept ? "accept" : "deny",
            JSON.stringify({ capacityMax, candidatePartySize, candidateKind, existing })
          );
        }
      ),
      { numRuns: 500 }
    );
  });

  it("accepts allocations exactly within every car's offered seats and rejects overflow", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 8 }), { minLength: 1, maxLength: 6 }).chain((seats) =>
          fc.array(
            fc.record({
              driverIndex: fc.integer({ min: 0, max: seats.length - 1 }),
              partySize: fc.integer({ min: 1, max: 5 }),
            }),
            { maxLength: 16 }
          ).map((passengers) => ({ seats, passengers }))
        ),
        ({ seats, passengers }) => {
          const participants = [
            ...seats.map((personalCarOccupants, index) => ({
              registrationId: `driver-${index}`,
              status: "approved",
              transportKind: "personal_car",
              personalCarOccupants,
              partySize: 1,
            })),
            ...passengers.map((passenger, index) => ({
              registrationId: `passenger-${index}`,
              status: "approved",
              transportKind: "no_car_dong",
              personalCarOccupants: null,
              partySize: passenger.partySize,
            })),
          ];
          const allocations = passengers.map((passenger, index) => ({
            driverRegistrationId: `driver-${passenger.driverIndex}`,
            passengerRegistrationId: `passenger-${index}`,
          }));
          const totals = Array.from({ length: seats.length }, (_, index) =>
            passengers.reduce(
              (sum, passenger) =>
                sum + (passenger.driverIndex === index ? passenger.partySize : 0),
              0
            )
          );
          const expectedAccept = totals.every((total, index) => total <= seats[index]!);

          assert.equal(
            validateTransportAllocations({
              tourId: "capacity-property-test",
              allocations,
              participants,
              rosterFrozen: false,
            }).ok,
            expectedAccept,
            JSON.stringify({ seats, passengers, totals })
          );
        }
      ),
      { numRuns: 500 }
    );
  });

  it("fails closed for a malformed non-null driver seat offer", () => {
    for (const offeredSeats of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5]) {
      const result = validateTransportAllocations({
        tourId: "capacity-property-test",
        allocations: [{ driverRegistrationId: "driver", passengerRegistrationId: "passenger" }],
        participants: [
          {
            registrationId: "driver",
            status: "approved",
            transportKind: "personal_car",
            personalCarOccupants: offeredSeats,
          },
          {
            registrationId: "passenger",
            status: "approved",
            transportKind: "no_car_dong",
            personalCarOccupants: null,
          },
        ],
        rosterFrozen: false,
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "INVALID_DRIVER_CAPACITY");
    }
  });

  it("preserves allocation invariants through generated add/assign/unassign/freeze command sequences", () => {
    const commands = [
      fc.integer({ min: 0, max: 4 }).map((seats) => new AddDriver(seats)),
      fc.integer({ min: 1, max: 4 }).map((partySize) => new AddPassenger(partySize)),
      fc
        .tuple(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 0, max: 12 }))
        .map(([driverPosition, passengerPosition]) =>
          new AssignPassenger(driverPosition, passengerPosition)
        ),
      fc.integer({ min: 0, max: 12 }).map((position) => new UnassignPassenger(position)),
      fc.constant(new FreezeRoster()),
      fc.constant(new AttemptFrozenChange()),
    ];

    fc.assert(
      fc.property(fc.commands(commands, { maxCommands: 40 }), (generated) => {
        const setup = () => ({
          model: {
            driverSeats: [],
            passengerPartySizes: [],
            assignments: new Map<number, number>(),
            frozen: false,
          },
          real: { participants: [], allocations: [], frozen: false },
        });
        fc.modelRun(setup, generated);
      }),
      { numRuns: 300 }
    );
  });
});
