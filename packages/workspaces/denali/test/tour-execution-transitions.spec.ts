import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertTourExecutionTransition,
  canTransitionTourExecution,
} from "../src/execution";

describe("tour execution lifecycle", () => {
  it("allows only the operational lifecycle", () => {
    assert.equal(canTransitionTourExecution("scheduled", "in_progress"), true);
    assert.equal(canTransitionTourExecution("in_progress", "completed"), true);
    assert.equal(canTransitionTourExecution("completed", "in_progress"), false);
  });

  it("fails closed for an invalid transition", () => {
    assert.throws(
      () => assertTourExecutionTransition("completed", "in_progress"),
      /TOUR_EXECUTION_TRANSITION_INVALID/
    );
  });
});
