/**
 * DP-2 read-model — compose tour operational roster projection tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BookingListItem } from "@app-tour/booking-http-contracts";

import {
  composeTourOperationalRosterRow,
  filterOperationalRosterRows,
  matchesOperationalRosterFilter,
} from "../src/roster/compose-tour-operational-roster.ts";

const NOW = "2026-08-24T12:00:00.000Z";

function booking(over: Partial<BookingListItem> = {}): BookingListItem {
  return {
    id: over.id ?? "reg-001",
    tourId: over.tourId ?? "tour-001",
    tourTitle: "Test Tour",
    guestLabel: over.guestLabel ?? "Guest Alpha",
    registrantTarget: "self",
    transportKind: over.transportKind ?? "primary",
    personalCarOccupants: over.personalCarOccupants ?? null,
    partySize: over.partySize ?? 1,
    status: over.status ?? "approved",
    paymentStatus: over.paymentStatus ?? "unpaid",
    departureAt: over.departureAt ?? "2031-08-01T10:00:00.000Z",
    submittedAt: over.submittedAt ?? "2026-08-20T10:00:00.000Z",
    ...(over.paymentDueAt !== undefined ? { paymentDueAt: over.paymentDueAt } : {}),
  };
}

describe("DP-2 compose tour operational roster", () => {
  it("approved unpaid row is operational but not final", () => {
    const row = composeTourOperationalRosterRow({
      booking: booking(),
      invoice: {
        remainingMinor: "2500000",
        paidAmountMinor: "0",
        invoiceTotalMinor: "2500000",
        currency: "IRR",
      },
      hold: { status: "open", dueAt: "2026-08-25T12:00:00.000Z" },
      refundStatuses: [],
      nowIso: NOW,
    });
    assert.equal(row.isOperationalParticipant, true);
    assert.equal(row.isFinalParticipant, false);
    assert.equal(row.financialDisplayState, "UNPAID");
    assert.equal(row.remainingMinor, "2500000");
    assert.equal(row.holdStatus, "open");
  });

  it("partial payment projection", () => {
    const row = composeTourOperationalRosterRow({
      booking: booking(),
      invoice: {
        remainingMinor: "500000",
        paidAmountMinor: "2000000",
        invoiceTotalMinor: "2500000",
        currency: "IRR",
      },
      hold: { status: "open", dueAt: "2026-08-25T12:00:00.000Z" },
      refundStatuses: [],
      nowIso: NOW,
    });
    assert.equal(row.financialDisplayState, "PARTIALLY_PAID");
    assert.equal(row.isFinalParticipant, false);
  });

  it("paid final participant", () => {
    const row = composeTourOperationalRosterRow({
      booking: booking(),
      invoice: {
        remainingMinor: "0",
        paidAmountMinor: "2500000",
        invoiceTotalMinor: "2500000",
        currency: "IRR",
      },
      hold: { status: "satisfied", dueAt: "2026-08-25T12:00:00.000Z" },
      refundStatuses: [],
      nowIso: NOW,
    });
    assert.equal(row.financialDisplayState, "PAID");
    assert.equal(row.isFinalParticipant, true);
    assert.equal(row.holdStatus, "satisfied");
  });

  it("waived zero-obligation registration", () => {
    const row = composeTourOperationalRosterRow({
      booking: booking({ paymentStatus: "paid" }),
      invoice: {
        remainingMinor: "0",
        paidAmountMinor: "0",
        invoiceTotalMinor: "0",
        currency: "IRR",
      },
      hold: null,
      refundStatuses: [],
      nowIso: NOW,
    });
    assert.equal(row.financialDisplayState, "WAIVED");
    assert.equal(row.isFinalParticipant, true);
  });

  it("waitlisted row", () => {
    const row = composeTourOperationalRosterRow({
      booking: booking({ status: "waitlisted" }),
      invoice: null,
      hold: null,
      refundStatuses: [],
      nowIso: NOW,
    });
    assert.equal(row.registrationStatus, "waitlisted");
    assert.equal(row.isOperationalParticipant, false);
    assert.equal(row.occupiesCapacity, false);
    assert.equal(row.financialDisplayState, "NOT_APPLICABLE");
  });

  it("cancelled expired hold row is not operational", () => {
    const row = composeTourOperationalRosterRow({
      booking: booking({ status: "cancelled" }),
      invoice: {
        remainingMinor: "2500000",
        paidAmountMinor: "0",
        invoiceTotalMinor: "2500000",
        currency: "IRR",
      },
      hold: { status: "expired", dueAt: "2026-08-23T12:00:00.000Z" },
      refundStatuses: [],
      nowIso: NOW,
    });
    assert.equal(row.isOperationalParticipant, false);
    assert.equal(row.financialDisplayState, "NOT_APPLICABLE");
  });

  it("refund badge orthogonal to payment state", () => {
    const row = composeTourOperationalRosterRow({
      booking: booking(),
      invoice: {
        remainingMinor: "0",
        paidAmountMinor: "2500000",
        invoiceTotalMinor: "2500000",
        currency: "IRR",
      },
      hold: { status: "satisfied", dueAt: "2026-08-25T12:00:00.000Z" },
      refundStatuses: ["Requested"],
      nowIso: NOW,
    });
    assert.equal(row.refundDisplayState, "in_flight");
    assert.equal(row.isFinalParticipant, true);
  });

  it("driver offer from personal_car transport", () => {
    const row = composeTourOperationalRosterRow({
      booking: booking({ transportKind: "personal_car", personalCarOccupants: 2 }),
      invoice: null,
      hold: null,
      refundStatuses: [],
      nowIso: NOW,
    });
    assert.equal(row.isDriverOffer, true);
    assert.equal(row.passengerAssignmentStatus, "not_implemented");
  });

  it("filters: final, unpaid, paid, expiring, waitlist", () => {
    const rows = [
      composeTourOperationalRosterRow({
        booking: booking({ id: "unpaid", guestLabel: "Unpaid Guest" }),
        invoice: {
          remainingMinor: "1000",
          paidAmountMinor: "0",
          invoiceTotalMinor: "1000",
          currency: "IRR",
        },
        hold: { status: "open", dueAt: "2026-08-24T20:00:00.000Z" },
        refundStatuses: [],
        nowIso: NOW,
      }),
      composeTourOperationalRosterRow({
        booking: booking({ id: "paid", guestLabel: "Paid Guest" }),
        invoice: {
          remainingMinor: "0",
          paidAmountMinor: "1000",
          invoiceTotalMinor: "1000",
          currency: "IRR",
        },
        hold: { status: "satisfied", dueAt: "2026-08-30T12:00:00.000Z" },
        refundStatuses: [],
        nowIso: NOW,
      }),
      composeTourOperationalRosterRow({
        booking: booking({
          id: "wait",
          guestLabel: "Wait Guest",
          status: "waitlisted",
          submittedAt: "2026-08-21T10:00:00.000Z",
        }),
        invoice: null,
        hold: null,
        refundStatuses: [],
        nowIso: NOW,
      }),
    ];

    assert.equal(
      filterOperationalRosterRows({ rows, filter: "unpaid", nowIso: NOW }).length,
      1
    );
    assert.equal(
      filterOperationalRosterRows({ rows, filter: "paid", nowIso: NOW }).length,
      1
    );
    assert.equal(
      filterOperationalRosterRows({ rows, filter: "final", nowIso: NOW }).length,
      1
    );
    assert.equal(
      filterOperationalRosterRows({ rows, filter: "expiring", nowIso: NOW }).length,
      1
    );
    assert.equal(
      filterOperationalRosterRows({ rows, filter: "waitlist", nowIso: NOW }).length,
      1
    );
    assert.equal(
      matchesOperationalRosterFilter(rows[0]!, "expiring", NOW),
      true
    );
  });

  it("transportKind post-filter", () => {
    const rows = [
      composeTourOperationalRosterRow({
        booking: booking({ id: "car", transportKind: "personal_car" }),
        invoice: null,
        hold: null,
        refundStatuses: [],
        nowIso: NOW,
      }),
      composeTourOperationalRosterRow({
        booking: booking({ id: "bus", transportKind: "primary" }),
        invoice: null,
        hold: null,
        refundStatuses: [],
        nowIso: NOW,
      }),
    ];
    const filtered = filterOperationalRosterRows({
      rows,
      filter: "operational",
      transportKind: "personal_car",
      nowIso: NOW,
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.registrationId, "car");
  });
});
