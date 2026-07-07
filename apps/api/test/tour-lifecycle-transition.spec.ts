/**
 * P5-B-N-003 — tour lifecycle FSM (LC-01..03)
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_LIFECYCLE } from "@app-tour/workspace-denali";

import {
  assertTourLifecycleTransition,
  TourLifecycleTransitionError,
} from "../src/canonical/assert-tour-lifecycle-transition.ts";

describe("tour-lifecycle-transition (P5-B LC-01..03)", () => {
  it("LC-01 DRAFT→OPEN allowed when transition is in plugin lifecycle", () => {
    assert.doesNotThrow(() =>
      assertTourLifecycleTransition({
        lifecycle: DENALI_LIFECYCLE,
        fromStatus: "DRAFT",
        toStatus: "OPEN",
      })
    );
  });

  it("LC-02 OPEN→DRAFT rejected", () => {
    assert.throws(
      () =>
        assertTourLifecycleTransition({
          lifecycle: DENALI_LIFECYCLE,
          fromStatus: "OPEN",
          toStatus: "DRAFT",
        }),
      (error: unknown) => {
        assert.ok(error instanceof TourLifecycleTransitionError);
        assert.match(
          (error as Error).message,
          /TOUR_LIFECYCLE_TRANSITION_REJECTED:OPEN->DRAFT/
        );
        return true;
      }
    );
  });

  it("LC-03 CANCELLED is terminal", () => {
    assert.throws(
      () =>
        assertTourLifecycleTransition({
          lifecycle: DENALI_LIFECYCLE,
          fromStatus: "CANCELLED",
          toStatus: "DRAFT",
        }),
      (error: unknown) => {
        assert.ok(error instanceof TourLifecycleTransitionError);
        assert.match((error as Error).message, /TOUR_LIFECYCLE_CANCELLED_TERMINAL/);
        return true;
      }
    );
  });
});
