/**
 * Workspace wizard step shell — one step visible at a time
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWizardStepDescriptors,
  clampWizardStepIndex,
  resolveWizardStepLabel,
  WIZARD_STEP_SHELL_TEST_IDS,
} from "../src/wizard/wizard-step-shell-logic";

describe("wizard-step-shell.spec.ts", () => {
  it("WEB-WIZ-STEP-01 resolves template step labels", () => {
    assert.equal(
      resolveWizardStepLabel("denali_basic", [
        { stepId: "denali_basic", label: "Basic info", enabled: true, fields: [] },
      ]),
      "Basic info"
    );
    assert.equal(resolveWizardStepLabel("denali_photos"), "عکس‌ها");
  });

  it("WEB-WIZ-STEP-02 builds descriptors from render plan", () => {
    const descriptors = buildWizardStepDescriptors([
      { stepId: "denali_basic", fields: [] },
      { stepId: "denali_photos", fields: [] },
    ]);
    assert.equal(descriptors.length, 2);
    assert.equal(descriptors[0]?.stepId, "denali_basic");
  });

  it("WEB-WIZ-STEP-03 clamps active step index", () => {
    assert.equal(clampWizardStepIndex(4, 6), 4);
    assert.equal(clampWizardStepIndex(9, 6), 5);
    assert.equal(clampWizardStepIndex(-1, 6), 0);
    assert.equal(clampWizardStepIndex(2, 0), 0);
  });

  it("WEB-WIZ-STEP-04 exposes stable test ids", () => {
    assert.equal(WIZARD_STEP_SHELL_TEST_IDS.next, "workspace-wizard-step-next");
    assert.equal(WIZARD_STEP_SHELL_TEST_IDS.back, "workspace-wizard-step-back");
  });
});
