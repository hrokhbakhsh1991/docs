import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "../src/denali.plugin";
import { loadDenaliWizardRulesModule } from "../src/wizard/denali-wizard-host-hooks";
import { validateDenaliWizardDraftSync } from "../src/wizard/denali-wizard-validation";
import {
  DENALI_AGE_MIN_AFTER_MAX,
  DENALI_CAPACITY_MIN_AFTER_MAX,
  isDenaliNumericMinAfterMax,
  parseDenaliWizardFiniteNumber,
} from "../src/ui/logic/denali-numeric-pair-policy";

describe("denali-numeric-pair-policy (ED-NUM-PAIR-01)", () => {
  it("parses finite numbers and treats empty as unset", () => {
    assert.equal(parseDenaliWizardFiniteNumber("20"), 20);
    assert.equal(parseDenaliWizardFiniteNumber(" 18.5 "), 18.5);
    assert.equal(parseDenaliWizardFiniteNumber(""), undefined);
    assert.equal(parseDenaliWizardFiniteNumber("  "), undefined);
    assert.equal(parseDenaliWizardFiniteNumber("abc"), undefined);
  });

  it("flags min after max only when both sides are set", () => {
    assert.equal(isDenaliNumericMinAfterMax("20", "12"), true);
    assert.equal(isDenaliNumericMinAfterMax("12", "12"), false);
    assert.equal(isDenaliNumericMinAfterMax("10", "12"), false);
    assert.equal(isDenaliNumericMinAfterMax("", "12"), false);
    assert.equal(isDenaliNumericMinAfterMax("20", ""), false);
  });

  it("DN-NUM-PAIR-01 basic step emits capacity min after max", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const draft = {
      data: {
        category: "mountain_day",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2027-07-01T08:00:00.000Z",
        capacityMin: "20",
        capacityMax: "12",
        tripDetails: { overview: { peakHeight: "4000" } },
      },
    };
    const stepFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_basic")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
      }));
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_basic",
      visibleSteps: [{ stepId: "denali_basic", fields: stepFields }],
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some((violation) => violation.code === DENALI_CAPACITY_MIN_AFTER_MAX),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("DN-NUM-PAIR-02 pricing step emits age min after max when both visible", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const draft = {
      data: {
        category: "mountain_day",
        participants: { minimumAge: "18", maximumAge: "10", fitnessLevel: "medium" },
      },
    };
    const stepFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_pricing")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
      }));
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_pricing",
      visibleSteps: [{ stepId: "denali_pricing", fields: stepFields }],
    });
    assert.ok(
      result.violations.some((violation) => violation.code === DENALI_AGE_MIN_AFTER_MAX),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("DN-NUM-PAIR-03 skips age pair when fields are hidden on the step", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const draft = {
      data: {
        category: "nature_day",
        participants: { minimumAge: "18", maximumAge: "10" },
      },
    };
    const stepFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_pricing")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: false,
        hidden:
          field.canonicalPath === "participants.minimumAge" ||
          field.canonicalPath === "participants.maximumAge" ||
          field.canonicalPath === "participants.fitnessLevel",
      }));
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_pricing",
      visibleSteps: [{ stepId: "denali_pricing", fields: stepFields }],
    });
    assert.equal(
      result.violations.some((violation) => violation.code === DENALI_AGE_MIN_AFTER_MAX),
      false,
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });
});
