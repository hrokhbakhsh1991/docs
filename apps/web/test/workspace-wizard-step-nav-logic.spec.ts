import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWizardStepContinueBlocked } from "../src/wizard/workspace-wizard-step-nav-logic";

describe("workspace-wizard-step-nav-logic (TW-03)", () => {
  it("WEB-WIZ-03-01 blocks continue when step validation fails", () => {
    assert.equal(
      isWizardStepContinueBlocked({
        usesStepValidation: true,
        stepId: "denali_basic",
        reviewStepId: "review",
        validate: () => ({ ok: false, issues: [] }),
      }),
      true
    );
  });

  it("WEB-WIZ-03-02 allows continue when step validation passes", () => {
    assert.equal(
      isWizardStepContinueBlocked({
        usesStepValidation: true,
        stepId: "denali_basic",
        reviewStepId: "review",
        validate: () => ({ ok: true, issues: [] }),
      }),
      false
    );
  });

  it("WEB-WIZ-03-03 review step never blocks continue footer", () => {
    assert.equal(
      isWizardStepContinueBlocked({
        usesStepValidation: true,
        stepId: "review",
        reviewStepId: "review",
        validate: () => ({ ok: false, issues: [] }),
      }),
      false
    );
  });
});
