import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePaymentFollowUpLoadOutcome,
  toPaymentFollowUpHttpError,
} from "../src/features/tours/tour-workspace-payment-follow-up-load";
import type { TourOperationalRosterRow } from "../src/features/tours/tour-workspace-transport-logic";

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
  it("loads approved roster rows", () => {
    const outcome = resolvePaymentFollowUpLoadOutcome({
      roster: { ok: true, items: [rosterRow()] },
    });
    assert.equal(outcome.rows.length, 1);
    assert.equal(outcome.error, null);
    assert.equal(outcome.rosterDegraded, false);
  });

  it("fails closed when roster fails (staging 503 path)", () => {
    const outcome = resolvePaymentFollowUpLoadOutcome({
      roster: { ok: false, error: toPaymentFollowUpHttpError("TOUR_ROSTER_HTTP", 503) },
    });
    assert.equal(outcome.rows.length, 0);
    assert.equal(outcome.error, "TOUR_ROSTER_HTTP_503");
    assert.equal(outcome.rosterDegraded, true);
  });

});
