import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterPaymentFollowUpParticipants,
  mapRosterRowToFollowUpParticipant,
  mergePaymentFollowUpParticipants,
  resolvePaymentFollowUpPrimaryAction,
  shouldShowPaymentFollowUpDeadline,
} from "../src/features/tours/tour-workspace-payment-follow-up-logic";
import type { TourOperationalRosterRow } from "../src/features/tours/tour-workspace-transport-logic";

function rosterRow(overrides: Partial<TourOperationalRosterRow> = {}): TourOperationalRosterRow {
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
  it("maps approved unpaid roster row to follow-up payment", () => {
    const row = mapRosterRowToFollowUpParticipant(rosterRow());
    assert.equal(row.listKind, "unpaid");
    assert.equal(row.primaryAction, "open_details");
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
    assert.equal(partial.primaryAction, "open_details");

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

  it("keeps the four operator scenarios distinct and actionable", () => {
    const approvedUnpaid = mapRosterRowToFollowUpParticipant(rosterRow());
    const approvedPaid = mapRosterRowToFollowUpParticipant(
      rosterRow({
        registrationId: "00000000-0000-4000-8000-000000000105",
        guestLabel: "Paid final",
        financialDisplayState: "PAID",
        remainingMinor: "0",
        isFinalParticipant: true,
        paymentDueAt: null,
      })
    );
    const approvedWaived = mapRosterRowToFollowUpParticipant(
      rosterRow({
        registrationId: "00000000-0000-4000-8000-000000000106",
        guestLabel: "Free final",
        financialDisplayState: "WAIVED",
        remainingMinor: "0",
        isFinalParticipant: true,
        paymentDueAt: null,
      })
    );

    assert.equal(approvedUnpaid.primaryAction, "open_details");
    assert.equal(approvedPaid.listKind, "settled");
    assert.equal(approvedPaid.primaryAction, "none");
    assert.equal(approvedWaived.listKind, "settled");
    assert.equal(approvedWaived.primaryAction, "none");
    assert.equal(
      filterPaymentFollowUpParticipants(
        [approvedUnpaid, approvedPaid, approvedWaived],
        "all",
        ""
      ).length,
      1
    );
  });

  it("builds the finance list from approved roster rows", () => {
    const merged = mergePaymentFollowUpParticipants({
      rosterRows: [
        rosterRow(),
        rosterRow({
          registrationId: "00000000-0000-4000-8000-000000000107",
          financialDisplayState: "PAID",
          remainingMinor: "0",
        }),
      ],
    });
    assert.equal(merged.length, 1);
  });

  it("filters unpaid and partial lists", () => {
    const rows = mergePaymentFollowUpParticipants({
      rosterRows: [
        rosterRow(),
        rosterRow({
          registrationId: "00000000-0000-4000-8000-000000000103",
          financialDisplayState: "PARTIALLY_PAID",
        }),
      ],
    });
    assert.equal(filterPaymentFollowUpParticipants(rows, "unpaid", "").length, 1);
    assert.equal(filterPaymentFollowUpParticipants(rows, "partial", "").length, 1);
    assert.equal(
      filterPaymentFollowUpParticipants(
        [...rows, mapRosterRowToFollowUpParticipant(rosterRow({ financialDisplayState: "PAID" }))],
        "all",
        ""
      ).every((row) => row.listKind !== "settled"),
      true
    );
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
    assert.deepEqual(
      resolvePaymentFollowUpPrimaryAction({
        registrationStatus: "rejected",
        financialDisplayState: null,
      }),
      {
        primary: "none",
      }
    );
  });
});
