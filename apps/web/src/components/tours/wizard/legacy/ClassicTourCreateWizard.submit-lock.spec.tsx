/**
 * Regression: classic wizard disables navigation/submit while create mutation is pending or succeeded.
 * {@link TourCreateWizard} uses {@link isWizardSubmitLocked} for `submitLocked` on Back / Next / Submit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { isWizardSubmitLocked } from "@/features/tours/wizard/wizardSubmitLock";

const shellSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "ClassicTourCreateWizard.tsx"),
  "utf8",
);
const reviewSubmitSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "steps", "ReviewSubmitStep.tsx"),
  "utf8",
);

test("ClassicTourCreateWizard wires submitLocked through isWizardSubmitLocked", () => {
  assert.match(shellSource, /isWizardSubmitLocked\(createMutation\)/);
  assert.match(shellSource, /disabled=\{[^}]*submitLocked/);
  assert.match(shellSource, /submitLocked,/);
  assert.match(shellSource, /isSubmitPending: createMutation\.isPending/);
});

test("ReviewSubmitStep uses wizard submitLocked from profile context", () => {
  assert.match(reviewSubmitSource, /submitLocked, isSubmitPending } = useTourWizardProfile\(\)/);
  assert.match(reviewSubmitSource, /disabled=\{submitLocked\}/);
  assert.match(reviewSubmitSource, /isSubmitPending \? t\("submitting"\)/);
  assert.doesNotMatch(reviewSubmitSource, /isSubmitting/);
});

test("submit buttons stay disabled when createMutation.isSuccess is true", () => {
  const createMutation = { isPending: false, isSuccess: true };
  assert.equal(isWizardSubmitLocked(createMutation), true);
});

test("submit buttons stay disabled when createMutation.isPending is true", () => {
  const createMutation = { isPending: true, isSuccess: false };
  assert.equal(isWizardSubmitLocked(createMutation), true);
});
