import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BookingListItem } from "../src/features/bookings/bookings-command-center-types";
import {
  filterPaymentFollowUpParticipants,
  mapPendingBookingToFollowUpRow,
  mapRosterRowToFollowUpParticipant,
  mergePaymentFollowUpParticipants,
  resolvePaymentFollowUpPrimaryAction,
  shouldShowPaymentFollowUpDeadline,
} from "../src/features/tours/tour-workspace-payment-follow-up-logic";
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

function rosterRow(
  overrides: Partial<TourOperationalRosterRow> = {}
): TourOperationalRosterRow {
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
    ...overrides,
  };
}

describe("tour-workspace-payment-follow-up-logic.spec.ts", () => {
  it("maps pending booking to approve actions", () => {
    const row = mapPendingBookingToFollowUpRow(pendingBooking());
    assert.equal(row.listKind, "pending");
    assert.equal(row.primaryAction, "approve_awaiting_payment");
    assert.equal(row.secondaryAction, "approve_without_payment");
  });

  it("maps approved unpaid roster row to follow-up payment", () => {
    const row = mapRosterRowToFollowUpParticipant(rosterRow());
    assert.equal(row.listKind, "unpaid");
    assert.equal(row.primaryAction, "follow_up_payment");
    assert.equal(row.paymentDueAt, "2026-08-30T00:00:00.000Z");
  });

  it("maps partial and settled roster rows", () => {
    const partial = mapRosterRowToFollowUpParticipant(
      rosterRow({
        registrationId: "00000000-0000-4000-8000-000000000103",
        guestLabel: "Partial",
        financialDisplayState: "PARTIALLY_PAID",
        remainingMinor: "500",
      })
    );
    assert.equal(partial.primaryAction, "follow_up_partial");

    const waived = mapRosterRowToFollowUpParticipant(
      rosterRow({
        registrationId: "00000000-0000-4000-8000-000000000104",
        guestLabel: "Waived",
        financialDisplayState: "WAIVED",
        remainingMinor: "0",
        isFinalParticipant: true,
      })
    );
    assert.equal(waived.listKind, "settled");
    assert.equal(waived.primaryAction, "none");
  });

  it("merges pending + roster without duplicate ids", () => {
    const merged = mergePaymentFollowUpParticipants({
      pendingBookings: [pendingBooking()],
      rosterRows: [rosterRow()],
    });
    assert.equal(merged.length, 2);
  });

  it("filters unpaid and partial lists", () => {
    const rows = mergePaymentFollowUpParticipants({
      pendingBookings: [pendingBooking()],
      rosterRows: [
        rosterRow(),
        rosterRow({
          registrationId: "00000000-0000-4000-8000-000000000103",
          financialDisplayState: "PARTIALLY_PAID",
        }),
      ],
    });
    assert.equal(filterPaymentFollowUpParticipants(rows, "unpaid", "").length, 2);
    assert.equal(filterPaymentFollowUpParticipants(rows, "partial", "").length, 1);
  });

  it("shows deadline only when payment is still required", () => {
    assert.equal(
      shouldShowPaymentFollowUpDeadline(
        mapRosterRowToFollowUpParticipant(
          rosterRow({ financialDisplayState: "WAIVED", paymentDueAt: "2026-08-30T00:00:00.000Z" })
        )
      ),
      false
    );
    assert.equal(
      shouldShowPaymentFollowUpDeadline(mapRosterRowToFollowUpParticipant(rosterRow())),
      true
    );
    assert.deepEqual(resolvePaymentFollowUpPrimaryAction({ registrationStatus: "rejected", financialDisplayState: null }), {
      primary: "none",
      secondary: null,
    });
  });
});
