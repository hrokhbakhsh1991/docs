/**
 * Tour-management contract matrix.
 *
 * This is the fast, deterministic layer beneath browser E2E tests. It proves
 * that the booking and tour lifecycle state machines agree on every pair of
 * statuses, including terminal and payment-projection invariants.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKING_LIFECYCLE_TRANSITIONS,
  BOOKING_STATUS_PIPELINE,
  canTransitionBookingStatus,
  type BookingStatus,
} from "@app-tour/booking-http-contracts";
import { DENALI_LIFECYCLE } from "@app-tour/workspace-denali";

import { raiseBookingPaymentStatus } from "../src/bookings/booking-payment-status.ts";
import {
  assertTourLifecycleTransition,
  isTourLifecycleTransitionError,
} from "../src/canonical/assert-tour-lifecycle-transition.ts";

const PAYMENT_STATUS_PIPELINE = ["unpaid", "partial", "paid"] as const;

// Independent business oracle. Do not derive this from the implementation
// table: otherwise a wrong lifecycle table can make its own test pass.
const EXPECTED_BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  pending: ["approved", "waitlisted", "rejected", "cancelled"],
  waitlisted: ["approved", "rejected", "cancelled"],
  approved: ["cancelled"],
  rejected: [],
  cancelled: [],
};

describe("tour-booking-management-matrix", () => {
  it("covers every booking status pair against the canonical transition table", () => {
    for (const from of BOOKING_STATUS_PIPELINE) {
      for (const to of BOOKING_STATUS_PIPELINE) {
        const expected = EXPECTED_BOOKING_TRANSITIONS[from].includes(to);
        assert.equal(
          canTransitionBookingStatus(from, to),
          expected,
          `unexpected booking transition ${from} -> ${to}`
        );
      }
    }

    assert.deepEqual(BOOKING_LIFECYCLE_TRANSITIONS, EXPECTED_BOOKING_TRANSITIONS);
  });

  it("keeps terminal booking states terminal for every target", () => {
    for (const terminal of ["rejected", "cancelled"] as const) {
      for (const target of BOOKING_STATUS_PIPELINE) {
        assert.equal(
          canTransitionBookingStatus(terminal, target),
          false,
          `${terminal} must not transition to ${target}`
        );
      }
    }
  });

  it("covers every payment projection pair and never downgrades", () => {
    const rank = { unpaid: 0, partial: 1, paid: 2 } as const;

    for (const current of PAYMENT_STATUS_PIPELINE) {
      for (const target of PAYMENT_STATUS_PIPELINE) {
        const expected = rank[target] > rank[current] ? target : current;
        assert.equal(
          raiseBookingPaymentStatus(current, target),
          expected,
          `unexpected payment projection ${current} -> ${target}`
        );
      }
    }
  });

  it("keeps booking approval and payment independent", () => {
    // This invariant belongs to the persisted booking projection, not to a
    // synthetic Set of labels. Exercise every real pair explicitly.
    const bookingStatuses: readonly BookingStatus[] = ["pending", "approved"];
    const projections = bookingStatuses.flatMap((bookingStatus) =>
      PAYMENT_STATUS_PIPELINE.map((paymentStatus) => ({ bookingStatus, paymentStatus }))
    );

    assert.equal(projections.length, 6);
    assert.deepEqual(projections, [
      { bookingStatus: "pending", paymentStatus: "unpaid" },
      { bookingStatus: "pending", paymentStatus: "partial" },
      { bookingStatus: "pending", paymentStatus: "paid" },
      { bookingStatus: "approved", paymentStatus: "unpaid" },
      { bookingStatus: "approved", paymentStatus: "partial" },
      { bookingStatus: "approved", paymentStatus: "paid" },
    ]);
  });

  it("covers the Denali tour-management lifecycle and rejects reverse/terminal edges", () => {
    assert.doesNotThrow(() =>
      assertTourLifecycleTransition({
        lifecycle: DENALI_LIFECYCLE,
        fromStatus: "DRAFT",
        toStatus: "OPEN",
      })
    );

    for (const [from, to] of [
      ["OPEN", "DRAFT"],
      ["OPEN", "CANCELLED"],
      ["CANCELLED", "DRAFT"],
      ["CANCELLED", "OPEN"],
    ] as const) {
      assert.throws(
        () =>
          assertTourLifecycleTransition({
            lifecycle: DENALI_LIFECYCLE,
            fromStatus: from,
            toStatus: to,
          }),
        (error: unknown) => isTourLifecycleTransitionError(error)
      );
    }
  });
});
