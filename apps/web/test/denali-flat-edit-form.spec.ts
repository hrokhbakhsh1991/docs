/**
 * Phase 12.4 — Denali flat edit form (no WorkspaceWizardHost on edit)
 * Authority: docs/phase-12/subphases/12.4-denali-flat-edit-form.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DENALI_FLAT_EDIT_SECTIONS_12_4A,
  DENALI_FLAT_EDIT_SECTIONS_FULL,
} from "@app-tour/workspace-denali/host/edit";

import { TOUR_EDIT_TEST_IDS } from "../src/features/tours/operator-tour-detail-types";
import { DENALI_FLAT_EDIT_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-flat-edit-test-ids";
import {
  filterFlatEditRenderSteps,
  filterFlatEditTemplateSteps,
} from "@app-tour/workspace-denali/host/ui/chrome/flat-edit-plan";

describe("denali-flat-edit-form.spec.ts — Phase 12.4 Web", () => {
  it("WEB-12.4-01 flat edit test ids align with operator tour edit landmarks", () => {
    assert.equal(DENALI_FLAT_EDIT_TEST_IDS.form, TOUR_EDIT_TEST_IDS.flatForm);
    assert.equal(
      DENALI_FLAT_EDIT_TEST_IDS.section("denali_basic"),
      TOUR_EDIT_TEST_IDS.flatSection("denali_basic")
    );
  });

  it("WEB-12.4-02 12.4a slice remains basic + program only", () => {
    assert.deepEqual([...DENALI_FLAT_EDIT_SECTIONS_12_4A], ["denali_basic", "denali_program"]);
  });

  it("WEB-12.4-02 12.4b default sections cover wizard rail minus review", () => {
    assert.deepEqual([...DENALI_FLAT_EDIT_SECTIONS_FULL], [
      "denali_basic",
      "denali_photos",
      "denali_program",
      "denali_logistics",
      "denali_pricing",
      "denali_legal",
    ]);
  });

  it("WEB-12.4-02 filterFlatEditRenderSteps keeps allowed step ids", () => {
    const steps = [
      { stepId: "denali_basic", fields: [] },
      { stepId: "denali_program", fields: [] },
      { stepId: "review", fields: [] },
    ] as const;
    const filtered = filterFlatEditRenderSteps(steps, DENALI_FLAT_EDIT_SECTIONS_FULL);
    assert.deepEqual(
      filtered.map((step) => step.stepId),
      ["denali_basic", "denali_program"]
    );
  });

  it("WEB-12.4-02 filterFlatEditTemplateSteps skips disabled and review", () => {
    const templateSteps = [
      { stepId: "denali_basic", enabled: true },
      { stepId: "denali_program", enabled: true },
      { stepId: "review", enabled: true },
      { stepId: "denali_logistics", enabled: false },
    ];
    const filtered = filterFlatEditTemplateSteps(templateSteps, DENALI_FLAT_EDIT_SECTIONS_FULL);
    assert.deepEqual(
      filtered.map((step) => step.stepId),
      ["denali_basic", "denali_program"]
    );
  });
});
