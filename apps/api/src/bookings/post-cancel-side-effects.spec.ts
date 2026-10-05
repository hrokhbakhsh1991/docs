import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldApplyPenalty, shouldQueueWaitlistReview } from "./post-cancel-side-effects.ts";

const POLICY = {
  paymentStatus: "paid",
  departureAt: "2026-10-10T12:00:00.000Z",
  cancellationDeadlineHours: 24,
  cancellationPenaltyPercentage: 25,
  tourCancelled: false,
} as const;

describe("post-cancel financial policy", () => {
  it("uses the persisted cancellation instant instead of the retry wall clock", () => {
    assert.equal(
      shouldApplyPenalty({
        ...POLICY,
        cancellationAt: "2026-10-09T11:59:59.999Z",
      }),
      false
    );
  });

  it("applies the penalty exactly at and after the persisted deadline", () => {
    assert.equal(
      shouldApplyPenalty({
        ...POLICY,
        cancellationAt: "2026-10-09T12:00:00.000Z",
      }),
      true
    );
    assert.equal(
      shouldApplyPenalty({
        ...POLICY,
        cancellationAt: "2026-10-10T11:00:00.000Z",
      }),
      true
    );
  });

  it("never penalizes a tour cancellation or an unpaid registration", () => {
    assert.equal(
      shouldApplyPenalty({
        ...POLICY,
        cancellationAt: null,
        tourCancelled: true,
      }),
      false
    );
    assert.equal(
      shouldApplyPenalty({
        ...POLICY,
        paymentStatus: "unpaid",
        cancellationAt: null,
      }),
      false
    );
  });

  it("does not require timestamps when the policy cannot apply a penalty", () => {
    assert.equal(
      shouldApplyPenalty({
        ...POLICY,
        cancellationAt: null,
        cancellationPenaltyPercentage: 0,
      }),
      false
    );
    assert.equal(
      shouldApplyPenalty({
        ...POLICY,
        cancellationAt: null,
        cancellationDeadlineHours: null,
      }),
      false
    );
  });

  it("fails closed when a financially relevant persisted timestamp is missing or invalid", () => {
    assert.throws(
      () => shouldApplyPenalty({ ...POLICY, cancellationAt: null }),
      /CANCELLATION_FINANCIAL_TIMESTAMP_INVALID/
    );
    assert.throws(
      () =>
        shouldApplyPenalty({
          ...POLICY,
          departureAt: "not-an-instant",
          cancellationAt: "2026-10-09T12:00:00.000Z",
        }),
      /CANCELLATION_FINANCIAL_TIMESTAMP_INVALID/
    );
  });

  it("keeps waitlist review tied to cancellation state instead of retry time", () => {
    assert.equal(
      shouldQueueWaitlistReview({
        previousStatus: "approved",
        departureAt: "2026-10-10T12:00:00.000Z",
        cancellationApprovedAt: "2026-10-09T12:00:00.000Z",
        persistedStatus: "pending",
      }),
      true
    );
    assert.equal(
      shouldQueueWaitlistReview({
        previousStatus: "approved",
        departureAt: "2026-10-10T12:00:00.000Z",
        cancellationApprovedAt: "2026-10-09T12:00:00.000Z",
        persistedStatus: "completed",
      }),
      false
    );
    assert.equal(
      shouldQueueWaitlistReview({
        previousStatus: "approved",
        departureAt: "not-an-instant",
        cancellationApprovedAt: null,
        persistedStatus: null,
      }),
      true
    );
  });
});
