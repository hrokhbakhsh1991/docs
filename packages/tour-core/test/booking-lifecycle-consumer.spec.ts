import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canTransitionBookingStatus,
  assertCanTransitionBookingStatus,
  listBookingTransitionsFrom,
  listBookingSourceStatusesForTarget,
} from "@app-tour/booking-http-contracts";

import {
  assertCanTransitionBookingViaGenericTable,
  canTransitionBookingViaGenericTable,
  listBookingTransitionSourcesForTarget,
  listBookingTransitionTargetsFrom,
} from "../src/transition/booking-lifecycle-consumer";

describe("booking-lifecycle-consumer (CW5-06)", () => {
  it("generic table matches booking-http-contracts edges", () => {
    const pairs: Array<[string, string]> = [
      ["pending", "approved"],
      ["pending", "waitlisted"],
      ["pending", "rejected"],
      ["pending", "cancelled"],
      ["waitlisted", "approved"],
      ["approved", "cancelled"],
      ["rejected", "cancelled"],
    ];
    for (const [from, to] of pairs) {
      assert.equal(
        canTransitionBookingViaGenericTable(from as never, to as never),
        canTransitionBookingStatus(from as never, to as never),
      );
    }
    assert.equal(
      canTransitionBookingViaGenericTable("approved", "pending"),
      false,
    );
  });

  it("assert helpers throw identical rejection semantics", () => {
    assert.throws(
      () => assertCanTransitionBookingViaGenericTable("approved", "pending"),
      /BOOKING_TRANSITION_REJECTED/,
    );
    assert.throws(
      () => assertCanTransitionBookingStatus("approved", "pending"),
      /BOOKING_TRANSITION_REJECTED/,
    );
  });

  it("list helpers match certified contract", () => {
    assert.deepEqual(
      listBookingTransitionTargetsFrom("pending"),
      listBookingTransitionsFrom("pending"),
    );
    assert.deepEqual(
      listBookingTransitionSourcesForTarget("approved"),
      listBookingSourceStatusesForTarget("approved"),
    );
  });
});
