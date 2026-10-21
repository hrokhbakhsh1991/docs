import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BookingRecord } from "./bookings.types.ts";
import { cancelTourRegistrations } from "./tour-cancellation.service.ts";

const registration = (input: {
  readonly id: string;
  readonly status: "approved" | "waitlisted";
  readonly partySize: number;
  readonly transportKind: "personal_car" | "no_car_dong";
  readonly personalCarOccupants?: 0 | 1 | 2 | 3;
}): BookingRecord => ({
  ...input,
  tenantId: "tenant-a",
  tourId: "tour-a",
  tourTitle: "Capacity release test",
  guestLabel: input.id,
  guestEmail: null,
  guestPhone: null,
  paymentStatus: "unpaid",
  departureAt: "2026-11-01T06:00:00.000Z",
  submittedAt: "2026-10-21T00:00:00.000Z",
  submittedByUserId: `user-${input.id}`,
  approvedAt: input.status === "approved" ? "2026-10-21T00:00:00.000Z" : null,
});

describe("tour cancellation with shared-car registrations", () => {
  it("cancels the whole tour without individual driver-seat rejection or waitlist promotion", async () => {
    const rows = [
      registration({
        id: "driver",
        status: "approved",
        partySize: 1,
        transportKind: "personal_car",
        personalCarOccupants: 2,
      }),
      registration({
        id: "dong",
        status: "approved",
        partySize: 2,
        transportKind: "no_car_dong",
      }),
      registration({
        id: "waitlisted",
        status: "waitlisted",
        partySize: 1,
        transportKind: "no_car_dong",
      }),
    ];
    const cancelled: string[] = [];
    const tourCancelledFlags: boolean[] = [];

    const result = await cancelTourRegistrations(
      { tenantId: "tenant-a", userId: "admin-a" },
      "tour-a",
      {
        repository: {
          listByTenant: async () => rows,
          cancelBooking: async ({ bookingId }) => {
            cancelled.push(bookingId);
            return rows.find(({ id }) => id === bookingId)!;
          },
        },
        postCancelSideEffects: async ({ tourCancelled }) => {
          tourCancelledFlags.push(tourCancelled === true);
          return { refundDrafted: false, settlementStatus: "not_affected" };
        },
        handleTourCancelledForSettlement: async () => undefined,
      }
    );

    assert.deepEqual(cancelled, ["driver", "dong", "waitlisted"]);
    assert.deepEqual(result.cancelledRegistrationIds, cancelled);
    assert.deepEqual(tourCancelledFlags, [true, true, true]);
    assert.deepEqual(result.failedRegistrationIds, []);
    assert.equal(result.settlementStatus, "completed");
  });
});
