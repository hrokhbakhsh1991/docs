import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasNonEmptyCanonicalValue,
  readDenaliDraftFieldValue,
  resolveDenaliInitialStepIndex,
} from "../src/wizard/resolve-initial-step-index";

const TEMPLATE_STEPS = [
  {
    stepId: "denali_basic",
    fields: [{ canonicalPath: "title" }, { canonicalPath: "category" }],
  },
  {
    stepId: "denali_program",
    fields: [{ canonicalPath: "program.difficultyLevel" }],
  },
] as const;

describe("resolve-initial-step-index.spec.ts", () => {
  it("DEN-RESUME-01 returns saved index when greater than zero", () => {
    assert.equal(
      resolveDenaliInitialStepIndex({ data: {} }, TEMPLATE_STEPS, 1),
      1
    );
  });

  it("DEN-RESUME-02 infers furthest step with data when saved index is zero", () => {
    const draft = { data: { title: "Tour", program: { difficultyLevel: 6 } } };
    assert.equal(resolveDenaliInitialStepIndex(draft, TEMPLATE_STEPS, 0), 1);
  });

  it("DEN-RESUME-03 reads legacy nested form paths", () => {
    const draft = {
      data: {
        basicInfo: { title: "Legacy title" },
      },
    };
    assert.equal(readDenaliDraftFieldValue(draft, "title"), "Legacy title");
  });

  it("DEN-RESUME-04 detects non-empty values", () => {
    assert.equal(hasNonEmptyCanonicalValue(""), false);
    assert.equal(hasNonEmptyCanonicalValue("x"), true);
  });

  it("DEN-RESUME-05 skipFieldInference keeps step 0 when stale program data exists", () => {
    const draft = { data: { title: "Tour", program: { difficultyLevel: 6 } } };
    assert.equal(
      resolveDenaliInitialStepIndex(draft, TEMPLATE_STEPS, 0, undefined, {
        skipFieldInference: true,
      }),
      0
    );
  });
});
