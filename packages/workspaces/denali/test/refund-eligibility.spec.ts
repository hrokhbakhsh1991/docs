/**
 * DP-6 — Denali refund eligibility policy unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeDenaliRefundEligibility } from "../src/booking/refund-eligibility.ts";

describe("computeDenaliRefundEligibility", () => {
  it("full refund when no penalty", () => {
    const result = computeDenaliRefundEligibility({
      collectedMinor: "100000000",
      refundedCompletedMinor: "0",
      cancellationPenaltyPercentage: 20,
      applyPenalty: false,
    });
    assert.equal(result.eligibleRefundMinor, "100000000");
    assert.equal(result.penaltyMinor, "0");
  });

  it("applies penalty percentage to collected gross", () => {
    const result = computeDenaliRefundEligibility({
      collectedMinor: "100000000",
      refundedCompletedMinor: "0",
      cancellationPenaltyPercentage: 20,
      applyPenalty: true,
    });
    assert.equal(result.penaltyMinor, "20000000");
    assert.equal(result.eligibleRefundMinor, "80000000");
  });

  it("subtracts prior completed refunds", () => {
    const result = computeDenaliRefundEligibility({
      collectedMinor: "100000000",
      refundedCompletedMinor: "30000000",
      cancellationPenaltyPercentage: null,
      applyPenalty: false,
    });
    assert.equal(result.financeCapMinor, "70000000");
    assert.equal(result.eligibleRefundMinor, "70000000");
  });

  it("zero when nothing collected", () => {
    const result = computeDenaliRefundEligibility({
      collectedMinor: "0",
      refundedCompletedMinor: "0",
      applyPenalty: true,
      cancellationPenaltyPercentage: 50,
    });
    assert.equal(result.eligibleRefundMinor, "0");
  });
});
