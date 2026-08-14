import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isApprovedBookingJourneyState,
  isApprovedBookingJourneyStateUnsettled,
  resolveBookingJourneyState,
} from "../src/booking-journey-state";

describe("booking journey state", () => {
  it("keeps approved bookings distinct by settlement", () => {
    assert.equal(
      resolveBookingJourneyState({ status: "approved", paymentStatus: "unpaid" }),
      "approved_unpaid"
    );
    assert.equal(
      resolveBookingJourneyState({ status: "approved", paymentStatus: "partial" }),
      "approved_partial"
    );
    assert.equal(
      resolveBookingJourneyState({ status: "approved", paymentStatus: "paid" }),
      "approved_paid"
    );
  });

  it("preserves non-approved lifecycle states", () => {
    assert.equal(
      resolveBookingJourneyState({ status: "pending", paymentStatus: "unpaid" }),
      "pending"
    );
    assert.equal(
      resolveBookingJourneyState({ status: "waitlisted", paymentStatus: "partial" }),
      "waitlisted"
    );
    assert.equal(
      resolveBookingJourneyState({ status: "rejected", paymentStatus: "paid" }),
      "rejected"
    );
    assert.equal(
      resolveBookingJourneyState({ status: "cancelled", paymentStatus: "unpaid" }),
      "cancelled"
    );
  });

  it("exposes approved and unsettled guards", () => {
    assert.equal(isApprovedBookingJourneyState("approved_partial"), true);
    assert.equal(isApprovedBookingJourneyState("pending"), false);
    assert.equal(isApprovedBookingJourneyStateUnsettled("approved_unpaid"), true);
    assert.equal(isApprovedBookingJourneyStateUnsettled("approved_paid"), false);
  });
});
