import assert from "node:assert/strict";
import test from "node:test";

import { composeWizardSteps } from "./compose-wizard-steps";

test("composeWizardSteps: no-op without overrides", () => {
  const base = ["basic", "theme", "review"] as const;
  assert.deepEqual(composeWizardSteps(base, undefined), ["basic", "theme", "review"]);
  assert.deepEqual(composeWizardSteps(base, { skip: [], insert: [] }), ["basic", "theme", "review"]);
});

test("composeWizardSteps: skip removes known step ids", () => {
  const base = ["basic", "theme", "itinerary", "participation", "review"] as const;
  assert.deepEqual(composeWizardSteps(base, { skip: ["itinerary", "participation"], insert: [] }), [
    "basic",
    "theme",
    "review",
  ]);
});

test("composeWizardSteps: ignores unknown skip ids", () => {
  const base = ["basic", "review"] as const;
  assert.deepEqual(composeWizardSteps(base, { skip: ["not-a-step"], insert: [] }), ["basic", "review"]);
});
