import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKING_LIFECYCLE_TRANSITIONS,
  BOOKING_STATUS_PIPELINE,
  canTransitionBookingStatus,
  listBookingSourceStatusesForTarget,
  listBookingTransitionsFrom,
} from "../src/booking-lifecycle-transitions";

describe("booking-lifecycle-transitions.spec.ts", () => {
  it("CW4-02 pipeline order matches CW0-04 vocabulary", () => {
    assert.deepEqual(BOOKING_STATUS_PIPELINE, [
      "pending",
      "approved",
      "waitlisted",
      "rejected",
      "cancelled",
    ]);
  });

  it("CW4-01 host-aligned edges", () => {
    assert.deepEqual([...listBookingTransitionsFrom("pending")], [
      "approved",
      "waitlisted",
      "rejected",
      "cancelled",
    ]);
    assert.deepEqual([...listBookingTransitionsFrom("waitlisted")], [
      "approved",
      "rejected",
      "cancelled",
    ]);
    assert.deepEqual([...listBookingTransitionsFrom("approved")], ["cancelled"]);
    assert.deepEqual([...listBookingTransitionsFrom("rejected")], []);
    assert.deepEqual([...listBookingTransitionsFrom("cancelled")], []);
  });

  it("listBookingSourceStatusesForTarget matches host repository guards", () => {
    assert.deepEqual([...listBookingSourceStatusesForTarget("approved")], [
      "pending",
      "waitlisted",
    ]);
    assert.deepEqual([...listBookingSourceStatusesForTarget("rejected")], [
      "pending",
      "waitlisted",
    ]);
    assert.deepEqual([...listBookingSourceStatusesForTarget("waitlisted")], [
      "pending",
    ]);
    assert.deepEqual([...listBookingSourceStatusesForTarget("cancelled")], [
      "pending",
      "approved",
      "waitlisted",
    ]);
  });

  it("illegal edges rejected", () => {
    assert.equal(canTransitionBookingStatus("rejected", "approved"), false);
    assert.equal(canTransitionBookingStatus("cancelled", "approved"), false);
    assert.equal(canTransitionBookingStatus("approved", "pending"), false);
    assert.equal(canTransitionBookingStatus("pending", "pending"), false);
  });

  it("BOOKING_LIFECYCLE_TRANSITIONS frozen adjacency", () => {
    assert.equal(
      BOOKING_LIFECYCLE_TRANSITIONS.pending.includes("approved"),
      true
    );
  });
});
