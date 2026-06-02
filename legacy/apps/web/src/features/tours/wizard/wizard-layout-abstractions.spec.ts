import assert from "node:assert/strict";
import test from "node:test";

import { denaliWizardSteps } from "@repo/denali-domain";

import { readFormValueAtPath } from "./shell/fieldAccess";
import {
  buildLayout,
  clearHiddenFieldErrors,
  createStepRegistryStub,
  getWizardLayout,
  resetLayoutCacheForTests,
} from "./shell/layout";

test("readFormValueAtPath walks dot paths without form schema coupling", () => {
  const values = {
    basicInfo: { tourType: "mountain_day" },
    participantRequirements: { gearItems: [{ id: "tent" }] },
  };
  assert.equal(readFormValueAtPath(values, "basicInfo.tourType"), "mountain_day");
  assert.deepEqual(readFormValueAtPath(values, "participantRequirements.gearItems"), [{ id: "tent" }]);
  assert.equal(readFormValueAtPath(values, "missing.path"), undefined);
});

test("clearHiddenFieldErrors uses manifest eviction strategy only", () => {
  const cleared: string[] = [];
  clearHiddenFieldErrors({
    form: { hidden: true },
    clearErrors: (path) => cleared.push(path),
    eviction: {
      collectHiddenFormPaths: () => ["transport.dongAmount", "programNature.difficultyLevel"],
    },
    ruleContext: { model: "stub" },
  });
  assert.deepEqual(cleared, ["transport.dongAmount", "programNature.difficultyLevel"]);
});

test("buildLayout injects domain hiddenFieldEviction binding", () => {
  const layout = buildLayout("denali_pilot", null, {
    stepComponentMap: createStepRegistryStub(denaliWizardSteps),
  });
  assert.equal(typeof layout.hiddenFieldEviction.collectHiddenFormPaths, "function");
  assert.equal(typeof layout.gearCatalogFilter.readFieldValue, "function");
  assert.equal(layout.gearCatalogFilter.classificationFieldPath, "basicInfo.tourType");
});

test("buildLayout provides step component registry map", () => {
  const layout = buildLayout("denali_pilot", null, {
    stepComponentMap: createStepRegistryStub(denaliWizardSteps),
  });
  assert.equal(typeof layout.stepComponentMap.denali_basic, "function");
  assert.equal(typeof layout.stepComponentMap.review, "function");
  for (const stepId of layout.stepRail.stepIds) {
    assert.equal(typeof layout.stepComponentMap[stepId], "function", stepId);
  }
});

test("getWizardLayout returns referentially stable manifests", () => {
  resetLayoutCacheForTests();
  const options = { stepComponentMap: createStepRegistryStub(denaliWizardSteps) };
  const first = getWizardLayout("denali_pilot", null, options);
  const second = getWizardLayout("denali_pilot", null, options);
  assert.equal(first, second);
  assert.equal(first.hiddenFieldEviction, second.hiddenFieldEviction);
  assert.equal(first.gearCatalogFilter, second.gearCatalogFilter);
  assert.equal(first.stepRail, second.stepRail);
});
