import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasGenericNonEmptyCanonicalValue,
  resolveGenericInitialStepIndex,
  stepsHaveStableResumeIdentity,
} from "../src/wizard/resolve-generic-initial-step-index";

const TEMPLATE_STEPS = [
  {
    stepId: "basics",
    fields: [{ canonicalPath: "basics.title" }, { canonicalPath: "basics.category" }],
  },
  {
    stepId: "details",
    fields: [{ canonicalPath: "details.summary" }],
  },
] as const;

describe("resolve-generic-initial-step-index.spec.ts (CW5-10)", () => {
  it("GEN-RESUME-01 returns saved index when greater than zero", () => {
    assert.equal(resolveGenericInitialStepIndex({ data: {} }, TEMPLATE_STEPS, 1), 1);
  });

  it("GEN-RESUME-02 infers furthest step with data when saved index is zero", () => {
    const draft = {
      data: {
        basics: { title: "Club tour" },
        details: { summary: "Summary" },
      },
    };
    assert.equal(resolveGenericInitialStepIndex(draft, TEMPLATE_STEPS, 0), 1);
  });

  it("GEN-RESUME-03 noop when steps lack stable stepId identity", () => {
    const draft = { data: { basics: { title: "Tour" } } };
    const unstableSteps = [{ stepId: "", fields: [{ canonicalPath: "basics.title" }] }];
    assert.equal(resolveGenericInitialStepIndex(draft, unstableSteps, 0), 0);
    assert.equal(stepsHaveStableResumeIdentity(unstableSteps), false);
  });

  it("GEN-RESUME-04 honors skipFieldInference", () => {
    const draft = { data: { basics: { title: "Tour" } } };
    assert.equal(
      resolveGenericInitialStepIndex(draft, TEMPLATE_STEPS, 0, { skipFieldInference: true }),
      0
    );
  });

  it("GEN-RESUME-05 treats false and none as non-empty (generic, not Denali phantom rules)", () => {
    assert.equal(hasGenericNonEmptyCanonicalValue(false), true);
    assert.equal(hasGenericNonEmptyCanonicalValue("none"), true);
    assert.equal(hasGenericNonEmptyCanonicalValue(""), false);
  });

  it("GEN-RESUME-06 clamps invalid saved index to plan bounds", () => {
    assert.equal(resolveGenericInitialStepIndex({ data: {} }, TEMPLATE_STEPS, 99), 1);
    assert.equal(resolveGenericInitialStepIndex({ data: {} }, TEMPLATE_STEPS, -1), 0);
  });
});
