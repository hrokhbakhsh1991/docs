import assert from "node:assert/strict";
import test from "node:test";

import {
  countAssignedPassengers,
  validateTransportAllocations,
} from "../src/transport/validate-transport-allocation";

const driver = {
  registrationId: "driver",
  status: "approved",
  transportKind: "personal_car",
  personalCarOccupants: 3,
  partySize: 1,
} as const;

test("car assignment capacity counts people in each passenger registration", () => {
  const allocation = [{ driverRegistrationId: "driver", passengerRegistrationId: "party-of-two" }];
  const participants = [
    driver,
    {
      registrationId: "party-of-two",
      status: "approved",
      transportKind: "no_car_dong",
      personalCarOccupants: null,
      partySize: 2,
    },
  ];

  assert.deepEqual(
    validateTransportAllocations({
      tourId: "tour",
      allocations: allocation,
      participants,
      rosterFrozen: false,
    }),
    { ok: true }
  );
  assert.equal(countAssignedPassengers(allocation, "driver", participants), 2);
});

test("car assignment rejects a party registered for a different transport mode", () => {
  const allocation = [{ driverRegistrationId: "driver", passengerRegistrationId: "party-of-four" }];
  const participants = [
    driver,
    {
      registrationId: "party-of-four",
      status: "approved",
      transportKind: "bus",
      personalCarOccupants: null,
      partySize: 4,
    },
  ];

  const result = validateTransportAllocations({
    tourId: "tour",
    allocations: allocation,
    participants,
    rosterFrozen: false,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "PASSENGER_TRANSPORT_INCOMPATIBLE");
});

test("legacy roster participants without partySize still count as one person", () => {
  const allocation = [{ driverRegistrationId: "driver", passengerRegistrationId: "legacy" }];
  assert.equal(countAssignedPassengers(allocation, "driver"), 1);
});
