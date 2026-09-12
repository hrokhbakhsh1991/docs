import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BookingListItem } from "../src/features/bookings/bookings-command-center-types";
import {
  resolvePaymentFollowUpLoadOutcome,
  toPaymentFollowUpHttpError,
} from "../src/features/tours/tour-workspace-payment-follow-up-load";
import type { TourOperationalRosterRow } from "../src/features/tours/tour-workspace-transport-logic";

const BOOKING_ID = "00000000-0000-4000-8000-000000000101";

function pendingBooking(): BookingListItem {
  return {
    id: BOOKING_ID,
    tourId: "tour-1",
    tourTitle: "Tour",
    guestLabel: "Ali Pending",
    partySize: 1,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: "2026-09-01T00:00:00.000Z",
    submittedAt: "2026-08-01T00:00:00.000Z",
    transportKind: null,
    personalCarOccupants: null,
  };
}

function rosterRow(): TourOperationalRosterRow {
  return {
    registrationId: "00000000-0000-4000-8000-000000000102",
    tourId: "tour-1",
    guestLabel: "Sara Unpaid",
    partySize: 1,
    registrationStatus: "approved",
    financialDisplayState: "UNPAID",
    remainingMinor: "1000",
    paidMinor: "0",
    currency: "IRR",
    paymentDueAt: "2026-08-30T00:00:00.000Z",
    holdStatus: "active",
    transportKind: null,
    personalCarOccupants: null,
    isDriverOffer: false,
    passengerAssignmentStatus: "unassigned",
    refundDisplayState: "none",
    isFinalParticipant: false,
    isOperationalParticipant: true,
    isFinanciallySettled: false,
    occupiesCapacity: true,
    departureAt: "2026-09-01T00:00:00.000Z",
    submittedAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("tour-workspace-payment-follow-up-load.spec.ts", () => {
  it("merges pending + roster when both succeed", () => {
    const outcome = resolvePaymentFollowUpLoadOutcome({
      pending: { ok: true, items: [pendingBooking()] },
      roster: { ok: true, items: [rosterRow()] },
    });
    assert.equal(outcome.rows.length, 2);
    assert.equal(outcome.error, null);
    assert.equal(outcome.rosterDegraded, false);
  });

  it("keeps pending rows when roster fails (staging 503 path)", () => {
    const outcome = resolvePaymentFollowUpLoadOutcome({
      pending: { ok: true, items: [pendingBooking()] },
      roster: { ok: false, error: toPaymentFollowUpHttpError("TOUR_ROSTER_HTTP", 503) },
    });
    assert.equal(outcome.rows.length, 1);
    assert.equal(outcome.rows[0]?.listKind, "pending");
    assert.equal(outcome.error, "TOUR_ROSTER_HTTP_503");
    assert.equal(outcome.rosterDegraded, true);
  });

  it("keeps roster rows when pending fails", () => {
    const outcome = resolvePaymentFollowUpLoadOutcome({
      pending: { ok: false, error: "BOOKINGS_PENDING_HTTP_500" },
      roster: { ok: true, items: [rosterRow()] },
    });
    assert.equal(outcome.rows.length, 1);
    assert.equal(outcome.rows[0]?.listKind, "unpaid");
    assert.equal(outcome.error, "BOOKINGS_PENDING_HTTP_500");
    assert.equal(outcome.rosterDegraded, false);
  });

  it("fails closed when both sources fail", () => {
    const outcome = resolvePaymentFollowUpLoadOutcome({
      pending: { ok: false, error: "BOOKINGS_PENDING_HTTP_500" },
      roster: { ok: false, error: "TOUR_ROSTER_HTTP_503" },
    });
    assert.equal(outcome.rows.length, 0);
    assert.equal(outcome.error, "BOOKINGS_PENDING_HTTP_500");
    assert.equal(outcome.rosterDegraded, false);
  });
});
