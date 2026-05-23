import assert from "node:assert/strict";
import test from "node:test";

import { denaliWizardSteps } from "./denaliStepConfig";
import { getWizardStepsForContext, resolveTourWizardMode } from "./tourWizardStepPlan";

test("denaliWizardSteps: MVP 6-step rail", () => {
  assert.equal(denaliWizardSteps.length, 6);
  assert.deepEqual([...denaliWizardSteps], [
    "denali_basic",
    "denali_program",
    "denali_logistics",
    "denali_pricing",
    "denali_photos",
    "review",
  ]);
});

test("getWizardStepsForContext: denali_pilot profile uses 6-step Denali rail", () => {
  const steps = getWizardStepsForContext({ wizardMode: "classic", formProfile: "denali_pilot" });
  assert.equal(steps.length, 6);
  assert.equal(steps[0], "denali_basic");
  assert.equal(steps.at(-1), "review");
});

test("getWizardStepsForContext: non-denali tenant keeps classic 9-step rail", () => {
  const steps = getWizardStepsForContext({ wizardMode: "classic", tenantSlug: "ws1-rbac" });
  assert.equal(steps.length, 9);
  assert.equal(steps[0], "basic");
});

test("resolveTourWizardMode from denali_pilot profile", () => {
  assert.equal(
    resolveTourWizardMode({ wizardMode: "classic", formProfile: "denali_pilot", tenantSlug: "other" }),
    "denali",
  );
});
