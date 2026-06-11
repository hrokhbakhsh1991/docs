import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileUserBookingSummary } from "../src/identity/compile-user-booking-summary";
import type { BookingRecord } from "../src/bookings/bookings.types";

describe("compile-user-booking-summary.spec.ts — R7", () => {
  it("API-R7-01 counts completed and cancelled trips", () => {
    const now = new Date("2026-06-10T12:00:00.000Z");
    const rows: BookingRecord[] = [
      {
        id: "b1",
        tenantId: "t1",
        tourId: "tour1",
        tourTitle: "Past Trek",
        guestLabel: "Guest",
        guestEmail: null,
        guestPhone: null,
        partySize: 2,
        status: "approved",
        paymentStatus: "paid",
        departureAt: "2026-06-01T00:00:00.000Z",
        submittedAt: "2026-05-01T00:00:00.000Z",
        submittedByUserId: "u1",
        approvedAt: "2026-05-02T00:00:00.000Z",
      },
      {
        id: "b2",
        tenantId: "t1",
        tourId: "tour2",
        tourTitle: "Future Trek",
        guestLabel: "Guest",
        guestEmail: null,
        guestPhone: null,
        partySize: 1,
        status: "pending",
        paymentStatus: "unpaid",
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-02T00:00:00.000Z",
        submittedByUserId: "u1",
        approvedAt: null,
      },
      {
        id: "b3",
        tenantId: "t1",
        tourId: "tour3",
        tourTitle: "Cancelled Trek",
        guestLabel: "Guest",
        guestEmail: null,
        guestPhone: null,
        partySize: 1,
        status: "cancelled",
        paymentStatus: "unpaid",
        departureAt: "2026-08-01T00:00:00.000Z",
        submittedAt: "2026-06-03T00:00:00.000Z",
        submittedByUserId: "u1",
        approvedAt: null,
      },
    ];

    const summary = compileUserBookingSummary(rows, now);
    assert.equal(summary.totalTrips, 3);
    assert.equal(summary.completedTrips, 1);
    assert.equal(summary.cancelledTrips, 1);
    assert.equal(summary.trips[0]?.bookingId, "b3");
  });
});
