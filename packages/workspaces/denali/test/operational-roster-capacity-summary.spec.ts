import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarizeOperationalRosterCapacity } from "../src/roster/operational-roster-capacity-summary.ts";

describe("Denali operational roster capacity summary", () => {
  it("keeps the ten-person tour ceiling separate from five shared-car seats", () => {
    const summary = summarizeOperationalRosterCapacity({
      capacityMax: 10,
      bookings: [
        ...[2, 1, 1, 1].map((seats) => ({
          status: "approved" as const,
          partySize: 1,
          transportKind: "personal_car",
          personalCarOccupants: seats,
        })),
        ...Array.from({ length: 5 }, () => ({
          status: "approved" as const,
          partySize: 1,
          transportKind: "no_car_dong",
          personalCarOccupants: null,
        })),
        {
          status: "waitlisted" as const,
          partySize: 1,
          transportKind: "no_car_dong",
          personalCarOccupants: null,
        },
        {
          status: "approved" as const,
          partySize: 1,
          transportKind: "no_car_acquaintance",
          personalCarOccupants: null,
        },
      ],
    });

    assert.equal(summary.approvedParticipants, 10);
    assert.equal(summary.remainingTourSeats, 0);
    assert.equal(summary.approvedDriverOffers, 5);
    assert.equal(summary.approvedDongParticipants, 5);
    assert.equal(summary.remainingDongSeats, 0);
    assert.equal(summary.waitlistedDongParticipants, 1);
    assert.equal(summary.dongWaitlistBlockedByCarSeats, false);
  });

  it("warns when global places remain but the dong waitlist has no approved car seats", () => {
    const summary = summarizeOperationalRosterCapacity({
      capacityMax: 10,
      bookings: [
        {
          status: "approved",
          partySize: 1,
          transportKind: "personal_car",
          personalCarOccupants: 1,
        },
        {
          status: "approved",
          partySize: 1,
          transportKind: "no_car_dong",
          personalCarOccupants: null,
        },
        {
          status: "waitlisted",
          partySize: 2,
          transportKind: "no_car_dong",
          personalCarOccupants: null,
        },
        { status: "pending", partySize: 2, transportKind: "personal_car", personalCarOccupants: 3 },
        {
          status: "pending",
          partySize: 1,
          transportKind: "no_car_dong",
          personalCarOccupants: null,
        },
      ],
    });

    assert.equal(summary.remainingTourSeats, 8);
    assert.equal(summary.remainingDongSeats, 0);
    assert.equal(summary.pendingParticipants, 3);
    assert.equal(summary.pendingDongParticipants, 1);
    assert.equal(summary.pendingDriverOffers, 3);
    assert.equal(summary.dongWaitlistBlockedByCarSeats, true);
  });

  it("warns when leftover car seats cannot fit any whole waitlisted party", () => {
    const summary = summarizeOperationalRosterCapacity({
      capacityMax: 10,
      bookings: [
        { status: "approved", partySize: 1, transportKind: "personal_car", personalCarOccupants: 2 },
        { status: "approved", partySize: 1, transportKind: "no_car_dong", personalCarOccupants: null },
        { status: "waitlisted", partySize: 2, transportKind: "no_car_dong", personalCarOccupants: null },
        { status: "waitlisted", partySize: 3, transportKind: "no_car_dong", personalCarOccupants: null },
      ],
    });

    assert.equal(summary.remainingDongSeats, 1);
    assert.equal(summary.remainingTourSeats, 8);
    assert.equal(summary.dongWaitlistBlockedByCarSeats, true);
  });
});
