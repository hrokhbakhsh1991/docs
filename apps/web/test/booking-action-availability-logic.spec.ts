import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bookingActionUnavailableMessageKey,
  resolveBookingActionAvailability,
} from "../src/features/bookings/booking-action-availability-logic";
import type { BookingListItem } from "../src/features/bookings/bookings-command-center-types";

function booking(status: BookingListItem["status"]): BookingListItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    guestLabel: "Guest",
    tourTitle: "Tour",
    tourId: "00000000-0000-4000-8000-000000000099",
    partySize: 1,
    status,
    paymentStatus: "unpaid",
    departureAt: "2026-09-01T08:00:00.000Z",
    submittedAt: "2026-08-01T08:00:00.000Z",
  };
}

describe("booking-action-availability-logic", () => {
  it("pending at capacity shows capacity hint and approve actions", () => {
    const result = resolveBookingActionAvailability({
      canManageOps: true,
      booking: booking("pending"),
      isWaitlistable: true,
      isCancellable: true,
      capacityFull: true,
    });
    assert.equal(result.canApprove, true);
    assert.equal(result.showCapacityFullHint, true);
  });

  it("approved routes to finance hint", () => {
    const result = resolveBookingActionAvailability({
      canManageOps: true,
      booking: booking("approved"),
      isWaitlistable: false,
      isCancellable: true,
      capacityFull: false,
    });
    assert.equal(result.canApprove, false);
    assert.equal(result.unavailableReason, "approved_use_finance");
  });

  it("terminal rejected blocks actions", () => {
    const result = resolveBookingActionAvailability({
      canManageOps: true,
      booking: booking("rejected"),
      isWaitlistable: false,
      isCancellable: false,
      capacityFull: false,
    });
    assert.equal(result.unavailableReason, "terminal_state");
  });

  it("message keys resolve for reason codes", () => {
    assert.equal(bookingActionUnavailableMessageKey("capacity_full"), "actionReason.capacity_full");
  });
});
