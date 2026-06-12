import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DENALI_FLAT_EDIT_SECTIONS_FULL,
  isDenaliFlatEditSection,
} from "../src/edit/denali-flat-edit-sections";
import { denaliWizardSteps } from "../src/layout/stepIds";

describe("denali-flat-edit-sections.spec.ts — Phase 12.4b", () => {
  it("LEG-12.4-01 flat edit sections match wizard rail minus review", () => {
    const expected = denaliWizardSteps.filter((stepId) => stepId !== "review");
    assert.deepEqual([...DENALI_FLAT_EDIT_SECTIONS_FULL], [...expected]);
    assert.equal(DENALI_FLAT_EDIT_SECTIONS_FULL.length, 6);
    assert.equal(isDenaliFlatEditSection("review"), false);
    assert.equal(isDenaliFlatEditSection("denali_legal"), true);
  });
});
