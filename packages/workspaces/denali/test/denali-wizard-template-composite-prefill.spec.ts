import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  coerceDenaliWizardTemplateDefaultValue,
  isDenaliCompositeDependentAllowedInTemplateStep,
  isDenaliWizardTemplateDefaultValueCoercible,
} from "../src/settings/denali-wizard-template-composite-prefill";

describe("denali-wizard-template-composite-prefill", () => {
  it("DENALI-TPL-COMP-01 allows dependent when anchor is on step", () => {
    const stepFields = [
      { canonicalPath: "participants.minimumAge" },
      { canonicalPath: "participants.fitnessLevel", hidden: true },
    ];
    assert.equal(
      isDenaliCompositeDependentAllowedInTemplateStep(stepFields, "participants.fitnessLevel"),
      true
    );
  });

  it("DENALI-TPL-COMP-02 rejects dependent without anchor", () => {
    assert.equal(
      isDenaliCompositeDependentAllowedInTemplateStep(
        [{ canonicalPath: "participants.fitnessLevel", hidden: true }],
        "participants.fitnessLevel"
      ),
      false
    );
  });

  it("DENALI-TPL-COMP-03 coerces fitnessLevel enum", () => {
    assert.equal(
      coerceDenaliWizardTemplateDefaultValue("participants.fitnessLevel", "high"),
      "high"
    );
    assert.equal(
      isDenaliWizardTemplateDefaultValueCoercible("participants.fitnessLevel", "invalid"),
      false
    );
  });

  it("DENALI-TPL-COMP-04 transport anchor lists composite dependents", () => {
    const stepFields = [
      { canonicalPath: "transport.mode" },
      { canonicalPath: "transport.transportCost", hidden: true },
    ];
    assert.equal(
      isDenaliCompositeDependentAllowedInTemplateStep(stepFields, "transport.transportCost"),
      true
    );
    assert.equal(
      coerceDenaliWizardTemplateDefaultValue("transport.transportCost", "150000"),
      "150000"
    );
  });
});
