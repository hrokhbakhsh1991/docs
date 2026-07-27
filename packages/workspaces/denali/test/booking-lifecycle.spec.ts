/**
 * Phase 1 — Denali booking lifecycle state machine.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDenaliBookingTransition,
  canTransitionDenaliBooking,
  createDenaliBookingPendingSnapshot,
  DENALI_BOOKING_STATUS_PIPELINE,
  listDenaliBookingTransitionsFrom,
} from "../src/booking/index.ts";

describe("booking-lifecycle.spec.ts — Denali Phase 1", () => {
  it("DN-B1-L01 status pipeline matches ops vocabulary", () => {
    assert.deepEqual([...DENALI_BOOKING_STATUS_PIPELINE], [
      "pending",
      "approved",
      "waitlisted",
      "rejected",
      "cancelled",
    ]);
  });

  it("DN-B1-L02 pending allows approve waitlist reject cancel", () => {
    assert.deepEqual([...listDenaliBookingTransitionsFrom("pending")], [
      "approved",
      "waitlisted",
      "rejected",
      "cancelled",
    ]);
  });

  it("DN-B1-L03 terminal statuses have no outbound edges", () => {
    assert.deepEqual([...listDenaliBookingTransitionsFrom("rejected")], []);
    assert.deepEqual([...listDenaliBookingTransitionsFrom("cancelled")], []);
    assert.equal(canTransitionDenaliBooking("rejected", "pending"), false);
    assert.equal(canTransitionDenaliBooking("cancelled", "approved"), false);
  });

  it("DN-B1-L04 create pending snapshot appends history", () => {
    const booking = createDenaliBookingPendingSnapshot({
      id: "b1",
      tourId: "t1",
      partySize: 2,
      at: "2026-07-26T10:00:00.000Z",
      actorId: "guest-1",
    });
    assert.equal(booking.status, "pending");
    assert.equal(booking.history.length, 1);
    assert.equal(booking.history[0]?.from, null);
    assert.equal(booking.history[0]?.to, "pending");
    assert.equal(booking.history[0]?.action, "create");
  });

  it("DN-B1-L05 legal transition appends history; illegal throws", () => {
    const pending = createDenaliBookingPendingSnapshot({
      id: "b2",
      tourId: "t1",
      partySize: 1,
      at: "2026-07-26T10:00:00.000Z",
    });
    const approved = applyDenaliBookingTransition({
      booking: pending,
      to: "approved",
      action: "approve",
      at: "2026-07-26T11:00:00.000Z",
      actorId: "op-1",
    });
    assert.equal(approved.booking.status, "approved");
    assert.equal(approved.booking.history.length, 2);
    assert.equal(approved.historyEntry.from, "pending");
    assert.equal(approved.historyEntry.to, "approved");

    assert.throws(
      () =>
        applyDenaliBookingTransition({
          booking: approved.booking,
          to: "pending",
          action: "approve",
        }),
      /DENALI_BOOKING_TRANSITION_REJECTED/
    );
  });

  it("DN-B1-L06 waitlisted may promote to approved or cancel/reject", () => {
    assert.equal(canTransitionDenaliBooking("waitlisted", "approved"), true);
    assert.equal(canTransitionDenaliBooking("waitlisted", "cancelled"), true);
    assert.equal(canTransitionDenaliBooking("waitlisted", "pending"), false);
  });
});
