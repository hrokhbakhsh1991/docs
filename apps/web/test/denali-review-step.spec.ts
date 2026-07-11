/**
 * Phase 11.7 — review step helpers
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendDenaliCloneTitleSuffix,
  buildDenaliFullWizardTemplateSteps,
  getDenaliWorkspacePlugin,
} from "@app-tour/workspace-denali";
import { getCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";
import { tourWizardDraftToCanonicalDocument } from "@app-tour/workspace-denali/host/ui/logic/denali-wizard-canonical";
import { DENALI_REVIEW_STEP_TEST_IDS } from "@app-tour/workspace-denali/host/ui/review/denali-review-step";

describe("denali-review-step.spec.ts — Phase 11.7", () => {
  it("WEB-P11-7-04 full template ends with review step", () => {
    const steps = buildDenaliFullWizardTemplateSteps();
    assert.equal(steps.at(-1)?.stepId, "review");
  });

  it("WEB-P11-7-05 draft maps to canonical document with plugin roots", () => {
    const draft = {
      data: {
        title: appendDenaliCloneTitleSuffix("Alpine"),
        category: "mountain_day",
      },
    };
    const roots = getDenaliWorkspacePlugin().wizard.roots;
    const document = tourWizardDraftToCanonicalDocument(draft, roots);
    assert.equal(document.data.title, "Alpine (Copy)");
    assert.equal(getCanonicalStringValue(draft, "title"), "Alpine (Copy)");
    assert.equal(document.roots.length > 0, true);
  });

  it("WEB-P11-7-06 review test ids are stable", () => {
    assert.equal(DENALI_REVIEW_STEP_TEST_IDS.panel, "denali-review-step");
    assert.equal(DENALI_REVIEW_STEP_TEST_IDS.heroCover, "denali-review-hero-cover");
    assert.equal(DENALI_REVIEW_STEP_TEST_IDS.photoGrid, "denali-review-photo-grid");
    assert.equal(DENALI_REVIEW_STEP_TEST_IDS.section("denali_basic"), "denali-review-section-denali_basic");
    assert.equal(
      DENALI_REVIEW_STEP_TEST_IDS.editSection("denali_basic"),
      "denali-review-edit-denali_basic"
    );
  });
});
