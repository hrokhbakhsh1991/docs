/**
 * BOOKINGS-OPS-UX P3b-a — list keyset helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compareBookingsByDepartureAtAsc,
  isBookingAfterDepartureKeysetCursor,
  isBookingAfterKeysetCursor,
  matchesBookingListFilters,
  resolveBookingListSortMode,
  resolveUtcApprovedWithinDaysWindow,
} from "./booking-list-query.ts";
import type { BookingRecord } from "./bookings.types.ts";

function stub(partial: Partial<BookingRecord> & Pick<BookingRecord, "id" | "departureAt" | "submittedAt">): BookingRecord {
  return {
    tenantId: "t",
    tourId: "tour",
    tourTitle: "Tour",
    guestLabel: "Guest",
    guestEmail: null,
    guestPhone: null,
    partySize: 1,
    status: "pending",
    paymentStatus: "unpaid",
    submittedByUserId: "u",
    approvedAt: null,
    ...partial,
  };
}

describe("booking-list-query.spec.ts — P3b-a", () => {
  it("resolves sort mode default submittedAt", () => {
    assert.equal(resolveBookingListSortMode(undefined), "submittedAt");
    assert.equal(resolveBookingListSortMode("submittedAt"), "submittedAt");
    assert.equal(resolveBookingListSortMode("departureAt"), "departureAt");
  });

  it("matches statuses IN filter for work queue", () => {
    const pending = stub({ id: "p", departureAt: "2026-08-01T00:00:00.000Z", submittedAt: "2026-07-01T00:00:00.000Z" });
    const waitlisted = stub({
      id: "w",
      status: "waitlisted",
      departureAt: "2026-08-02T00:00:00.000Z",
      submittedAt: "2026-07-02T00:00:00.000Z",
    });
    const approved = stub({
      id: "a",
      status: "approved",
      departureAt: "2026-08-03T00:00:00.000Z",
      submittedAt: "2026-07-03T00:00:00.000Z",
    });
    const filter = { statuses: ["pending", "waitlisted"] as const };
    assert.equal(matchesBookingListFilters(pending, filter), true);
    assert.equal(matchesBookingListFilters(waitlisted, filter), true);
    assert.equal(matchesBookingListFilters(approved, filter), false);
    assert.equal(matchesBookingListFilters(pending, { status: "pending" }), true);
    assert.equal(matchesBookingListFilters(waitlisted, { status: "pending" }), false);
  });

  it("matches approvedAt UTC-day window (approvedWithinDays=1)", () => {
    const now = new Date("2026-08-07T15:00:00.000Z");
    const window = resolveUtcApprovedWithinDaysWindow(now, 1);
    assert.equal(window.approvedFrom, "2026-08-07T00:00:00.000Z");
    assert.equal(window.approvedTo, "2026-08-08T00:00:00.000Z");

    const today = stub({
      id: "t",
      status: "approved",
      approvedAt: "2026-08-07T12:00:00.000Z",
      departureAt: "2026-09-01T00:00:00.000Z",
      submittedAt: "2026-08-01T00:00:00.000Z",
    });
    const yesterday = stub({
      id: "y",
      status: "approved",
      approvedAt: "2026-08-06T12:00:00.000Z",
      departureAt: "2026-09-01T00:00:00.000Z",
      submittedAt: "2026-08-01T00:00:00.000Z",
    });
    assert.equal(matchesBookingListFilters(today, { status: "approved", ...window }), true);
    assert.equal(matchesBookingListFilters(yesterday, { status: "approved", ...window }), false);
    assert.equal(matchesBookingListFilters(today, { status: "approved" }), true);
  });

  it("orders soonest departure first", () => {
    const early = stub({ id: "a", departureAt: "2026-08-01T00:00:00.000Z", submittedAt: "2026-07-01T00:00:00.000Z" });
    const late = stub({ id: "b", departureAt: "2026-08-10T00:00:00.000Z", submittedAt: "2026-07-02T00:00:00.000Z" });
    assert.ok(compareBookingsByDepartureAtAsc(early, late) < 0);
    assert.ok(compareBookingsByDepartureAtAsc(late, early) > 0);
  });

  it("departure keyset advances past cursor in ASC order", () => {
    const cursor = { departureAt: "2026-08-05T00:00:00.000Z", id: "m" };
    assert.equal(
      isBookingAfterDepartureKeysetCursor(
        stub({ id: "z", departureAt: "2026-08-05T00:00:00.000Z", submittedAt: "x" }),
        cursor
      ),
      true
    );
    assert.equal(
      isBookingAfterDepartureKeysetCursor(
        stub({ id: "a", departureAt: "2026-08-05T00:00:00.000Z", submittedAt: "x" }),
        cursor
      ),
      false
    );
    assert.equal(
      isBookingAfterDepartureKeysetCursor(
        stub({ id: "a", departureAt: "2026-08-06T00:00:00.000Z", submittedAt: "x" }),
        cursor
      ),
      true
    );
    assert.equal(
      isBookingAfterDepartureKeysetCursor(
        stub({ id: "z", departureAt: "2026-08-04T00:00:00.000Z", submittedAt: "x" }),
        cursor
      ),
      false
    );
  });

  it("submittedAt keyset still older-first", () => {
    const cursor = { submittedAt: "2026-07-05T00:00:00.000Z", id: "m" };
    assert.equal(
      isBookingAfterKeysetCursor(
        stub({ id: "a", departureAt: "x", submittedAt: "2026-07-04T00:00:00.000Z" }),
        cursor
      ),
      true
    );
  });
});
