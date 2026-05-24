import assert from "node:assert/strict";
import test from "node:test";

import type { BookingDto } from "@repo/types";

import {
  deriveDriverLoadRows,
  sortDriversByLoad,
  type TransportDriverRow,
} from "./build-tour-transport-roster";

test("sortDriversByLoad puts zero-assignment drivers first", () => {
  const rows = sortDriversByLoad([
    {
      id: "d2",
      source: "registration",
      driverName: "B",
      availableSeats: 2,
      passengersAssigned: 2,
      passengerNames: ["p1", "p2"],
      status: "full",
    },
    {
      id: "d1",
      source: "registration",
      driverName: "A",
      availableSeats: 3,
      passengersAssigned: 0,
      passengerNames: [],
      status: "has_capacity",
    },
  ]);

  assert.equal(rows[0]?.id, "d1");
  assert.equal(rows[1]?.id, "d2");
});

test("deriveDriverLoadRows counts assignments per driver", () => {
  const drivers: TransportDriverRow[] = [
    { id: "d1", source: "registration", driverName: "Ali", availableSeats: 2 },
  ];
  const passengers = [
    { id: "p1", passengerName: "Sara", registrationId: "p1" },
    { id: "p2", passengerName: "Reza", registrationId: "p2" },
  ];
  const rows = deriveDriverLoadRows(drivers, passengers, { p1: "d1" });
  assert.equal(rows[0]?.passengersAssigned, 1);
  assert.equal(rows[0]?.status, "has_capacity");
});
