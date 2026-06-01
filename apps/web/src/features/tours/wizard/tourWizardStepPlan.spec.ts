import assert from "node:assert/strict";
import test from "node:test";

import { denaliWizardSteps } from "./denaliStepConfig";
import { getWizardStepsForContext, resolveTourWizardMode } from "./tourWizardStepPlan";

test("denaliWizardSteps: MVP 7-step rail", () => {
  assert.equal(denaliWizardSteps.length, 7);
  assert.deepEqual([...denaliWizardSteps], [
    "denali_basic",
    "denali_photos",
    "denali_program",
    "denali_logistics",
    "denali_pricing",
    "denali_legal",
    "review",
  ]);
});

test("getWizardStepsForContext: always returns Denali rail", () => {
  const steps = getWizardStepsForContext({ wizardMode: "classic", formProfile: "denali_pilot" });
  assert.equal(steps.length, 7);
  assert.equal(steps[0], "denali_basic");
  assert.equal(steps.at(-1), "review");
});

test("getWizardStepsForContext: same rail for non-denali profile context", () => {
  const steps = getWizardStepsForContext({ wizardMode: "classic", tenantSlug: "ws1-rbac" });
  assert.deepEqual([...steps], [...denaliWizardSteps]);
});

test("resolveTourWizardMode from denali_pilot profile", () => {
  assert.equal(
    resolveTourWizardMode({ wizardMode: "classic", formProfile: "denali_pilot", tenantSlug: "other" }),
    "denali",
  );
});
