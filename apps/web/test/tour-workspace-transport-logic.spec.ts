import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAssignDongParticipantToDriver,
  type TourTransportParticipant,
} from "../src/features/tours/tour-workspace-transport-logic";

const driver = (personalCarOccupants: number): TourTransportParticipant => ({
  registrationId: "driver",
  guestLabel: "Test driver",
  partySize: 1,
  transportKind: "personal_car",
  personalCarOccupants,
});

const passenger = (
  registrationId: string,
  partySize: number
): TourTransportParticipant => ({
  registrationId,
  guestLabel: `Test passenger ${registrationId}`,
  partySize,
  transportKind: "no_car_dong",
  personalCarOccupants: null,
});

describe("canAssignDongParticipantToDriver", () => {
  const cases = [
    {
      name: "accepts a group exactly filling the offered car seats",
      candidate: passenger("candidate", 2),
      passengers: [passenger("candidate", 2)],
      assignments: {},
      capacity: 2,
      expected: true,
    },
    {
      name: "accepts the last seat when the other passenger already occupies one",
      candidate: passenger("candidate", 1),
      passengers: [passenger("other", 1), passenger("candidate", 1)],
      assignments: { other: "driver" },
      capacity: 2,
      expected: true,
    },
    {
      name: "rejects a group that exceeds the car seats even when tour capacity is separate",
      candidate: passenger("candidate", 1),
      passengers: [passenger("other", 2), passenger("candidate", 1)],
      assignments: { other: "driver" },
      capacity: 2,
      expected: false,
    },
    {
      name: "allows keeping the current passenger assignment at exact capacity",
      candidate: passenger("candidate", 1),
      passengers: [passenger("other", 1), passenger("candidate", 1)],
      assignments: { other: "driver", candidate: "driver" },
      capacity: 2,
      expected: true,
    },
    {
      name: "rejects drivers and passengers using incompatible transport kinds",
      candidate: { ...passenger("candidate", 1), transportKind: "organized" },
      passengers: [passenger("candidate", 1)],
      assignments: {},
      capacity: 2,
      expected: false,
    },
  ] as const;

  for (const scenario of cases) {
    it(scenario.name, () => {
      assert.equal(
        canAssignDongParticipantToDriver({
          driver: driver(scenario.capacity),
          passenger: scenario.candidate,
          passengerRows: scenario.passengers,
          assignments: scenario.assignments,
        }),
        scenario.expected
      );
    });
  }
});
