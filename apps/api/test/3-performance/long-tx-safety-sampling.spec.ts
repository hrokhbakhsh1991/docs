import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateIdleInTxDeltaSamples,
  LONG_TX_REQUIRED_CONSECUTIVE_POSITIVE_SAMPLES,
} from "./long-tx-safety-sampling";

describe("long-tx-safety sampling — sustained positive detection", () => {
  it("A: [0,0,0] passes", () => {
    const verdict = evaluateIdleInTxDeltaSamples([0, 0, 0]);
    assert.equal(verdict.sustainedViolation, false);
    assert.equal(verdict.maxDelta, 0);
    assert.equal(verdict.maxConsecutivePositive, 0);
  });

  it("B: [0,1,0] passes (isolated blip)", () => {
    const verdict = evaluateIdleInTxDeltaSamples([0, 1, 0]);
    assert.equal(verdict.sustainedViolation, false);
    assert.equal(verdict.maxDelta, 1);
    assert.equal(verdict.maxConsecutivePositive, 1);
    assert.equal(verdict.isolatedPositiveSampleCount, 1);
  });

  it("C: [0,1,1] fails (sustained)", () => {
    const verdict = evaluateIdleInTxDeltaSamples([0, 1, 1]);
    assert.equal(verdict.sustainedViolation, true);
    assert.equal(verdict.maxConsecutivePositive, 2);
  });

  it("D: [1,1] fails (sustained from first sample)", () => {
    const verdict = evaluateIdleInTxDeltaSamples([1, 1]);
    assert.equal(verdict.sustainedViolation, true);
    assert.equal(verdict.maxConsecutivePositive, 2);
  });

  it("E: [0,1,0,1,0] passes (two isolated blips)", () => {
    const verdict = evaluateIdleInTxDeltaSamples([0, 1, 0, 1, 0]);
    assert.equal(verdict.sustainedViolation, false);
    assert.equal(verdict.maxConsecutivePositive, 1);
    assert.equal(verdict.isolatedPositiveSampleCount, 2);
  });

  it("requires configurable consecutive threshold", () => {
    assert.equal(
      evaluateIdleInTxDeltaSamples([0, 1, 1, 0], 3).sustainedViolation,
      false
    );
    assert.equal(
      evaluateIdleInTxDeltaSamples([1, 1, 1], LONG_TX_REQUIRED_CONSECUTIVE_POSITIVE_SAMPLES)
        .sustainedViolation,
      true
    );
  });
});
