import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RenderStepPlan } from "@app-tour/platform-core";

import {
  computeDenaliWizardCompletion,
  isDenaliWizardFieldFilled,
} from "@app-tour/workspace-denali/ui/logic/denali-wizard-completion";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { setCanonicalStringValue, setCanonicalValue } from "../src/tours/tour-wizard-draft-path";

const sampleSteps: readonly RenderStepPlan[] = [
  {
    stepId: "denali_basics",
    fields: [
      { fieldId: "title", canonicalPath: "title", editorKind: "text" },
      { fieldId: "category", canonicalPath: "category", editorKind: "enum" },
    ],
  },
  {
    stepId: "review",
    fields: [{ fieldId: "publishStatus", canonicalPath: "publishStatus", editorKind: "enum" }],
  },
];

describe("denali-wizard-completion", () => {
  it("treats empty strings as unfilled", () => {
    const draft = emptyTourWizardDraft();
    assert.equal(isDenaliWizardFieldFilled(draft, "title"), false);
  });

  it("counts non-empty strings and arrays as filled", () => {
    let draft = setCanonicalStringValue(emptyTourWizardDraft(), "title", "Alborz day hike");
    assert.equal(isDenaliWizardFieldFilled(draft, "title"), true);

    draft = setCanonicalValue(draft, "leaderUserIds", ["user-1"]);
    assert.equal(isDenaliWizardFieldFilled(draft, "leaderUserIds"), true);
  });

  it("excludes review step and zero-weight fields from completion", () => {
    const empty = computeDenaliWizardCompletion(emptyTourWizardDraft(), sampleSteps);
    assert.equal(empty.total, 9);
    assert.equal(empty.percent, 0);

    const partial = computeDenaliWizardCompletion(
      setCanonicalStringValue(emptyTourWizardDraft(), "title", "Peak tour"),
      sampleSteps
    );
    assert.equal(partial.earned, 5);
    assert.equal(partial.percent, 56);
  });
});
