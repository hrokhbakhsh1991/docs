/**
 * Operator-side matrix for the tour booking command center.
 * The API/domain matrix owns transition legality; this layer owns what the
 * admin surface may show and do for each resulting booking state.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { bookingPaymentLabelKey } from "../src/features/bookings/booking-payment-display";
import { resolveBookingActionAvailability } from "../src/features/bookings/booking-action-availability-logic";
import type { BookingListItem } from "../src/features/bookings/bookings-command-center-types";

const BOOKING_STATUSES = ["pending", "approved", "waitlisted", "rejected", "cancelled"] as const;

const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;

function booking(
  status: BookingListItem["status"],
  paymentStatus: BookingListItem["paymentStatus"] = "unpaid"
): BookingListItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    tourId: "00000000-0000-4000-8000-000000000099",
    tourTitle: "Damavand One Day",
    guestLabel: "Guest",
    partySize: 1,
    status,
    paymentStatus,
    transportKind: null,
    personalCarOccupants: null,
    departureAt: "2026-09-01T08:00:00.000Z",
    submittedAt: "2026-08-01T08:00:00.000Z",
  };
}

describe("tour-booking-management-matrix (admin surface)", () => {
  it("covers action availability for every booking status", () => {
    for (const status of BOOKING_STATUSES) {
      const result = resolveBookingActionAvailability({
        canManageOps: true,
        booking: booking(status),
        isWaitlistable: true,
        isCancellable: true,
        capacityFull: false,
      });

      if (status === "pending" || status === "waitlisted") {
        assert.deepEqual(
          result,
          {
            canApprove: true,
            canApproveWithoutPayment: true,
            canReject: true,
            canWaitlist: true,
            canCancel: true,
            unavailableReason: null,
            showCapacityFullHint: false,
          },
          status
        );
      } else if (status === "approved") {
        assert.deepEqual(
          result,
          {
            canApprove: false,
            canApproveWithoutPayment: false,
            canReject: false,
            canWaitlist: false,
            canCancel: true,
            unavailableReason: "approved_use_finance",
            showCapacityFullHint: false,
          },
          status
        );
      } else {
        assert.deepEqual(
          result,
          {
            canApprove: false,
            canApproveWithoutPayment: false,
            canReject: false,
            canWaitlist: false,
            canCancel: false,
            unavailableReason: "terminal_state",
            showCapacityFullHint: false,
          },
          status
        );
      }
    }
  });

  it("covers waitlist, cancel, and capacity permutations for actionable bookings", () => {
    for (const status of ["pending", "waitlisted"] as const) {
      for (const isWaitlistable of [false, true] as const) {
        for (const isCancellable of [false, true] as const) {
          for (const capacityFull of [false, true] as const) {
            const result = resolveBookingActionAvailability({
              canManageOps: true,
              booking: booking(status),
              isWaitlistable,
              isCancellable,
              capacityFull,
            });

            assert.equal(result.canApprove, true, `${status}:${isWaitlistable}:${isCancellable}`);
            assert.equal(result.canApproveWithoutPayment, true, status);
            assert.equal(result.canReject, true, status);
            assert.equal(result.canWaitlist, isWaitlistable, status);
            assert.equal(result.canCancel, isCancellable, status);
            assert.equal(result.showCapacityFullHint, capacityFull, status);
          }
        }
      }
    }
  });

  it("removes every operator action for a non-admin", () => {
    for (const status of BOOKING_STATUSES) {
      const result = resolveBookingActionAvailability({
        canManageOps: false,
        booking: booking(status),
        isWaitlistable: true,
        isCancellable: true,
        capacityFull: false,
      });

      assert.equal(result.canApprove, false, status);
      assert.equal(result.canReject, false, status);
      assert.equal(result.canWaitlist, false, status);
      assert.equal(result.canCancel, false, status);
      assert.equal(result.unavailableReason, "not_admin", status);
    }
  });

  it("keeps payment labels independent from booking approval state", () => {
    for (const bookingStatus of BOOKING_STATUSES) {
      for (const paymentStatus of PAYMENT_STATUSES) {
        assert.equal(
          bookingPaymentLabelKey(booking(bookingStatus, paymentStatus)),
          `payment.${paymentStatus}`,
          `${bookingStatus}:${paymentStatus}`
        );
      }
    }

    assert.equal(
      bookingPaymentLabelKey({ paymentStatus: "paid", financialDisplayState: "WAIVED" }),
      "payment.waived"
    );
  });

  it("fails closed for missing and unknown booking states", () => {
    assert.deepEqual(
      resolveBookingActionAvailability({
        canManageOps: true,
        booking: null,
        isWaitlistable: true,
        isCancellable: true,
        capacityFull: true,
      }),
      {
        canApprove: false,
        canApproveWithoutPayment: false,
        canReject: false,
        canWaitlist: false,
        canCancel: false,
        unavailableReason: null,
        showCapacityFullHint: false,
      }
    );

    assert.equal(
      resolveBookingActionAvailability({
        canManageOps: true,
        booking: booking("unknown" as BookingListItem["status"]),
        isWaitlistable: true,
        isCancellable: true,
        capacityFull: false,
      }).unavailableReason,
      "wrong_status"
    );
  });

  it("keeps every queue status option localized in EN and FA", () => {
    for (const locale of ["en", "fa"] as const) {
      const messages = JSON.parse(
        readFileSync(new URL(`../messages/${locale}/bookings.json`, import.meta.url), "utf8")
      ) as { status?: Record<string, unknown> };

      for (const status of ["all", "actionable", ...BOOKING_STATUSES]) {
        assert.equal(typeof messages.status?.[status], "string", `${locale}:${status}`);
      }
    }
  });
});
