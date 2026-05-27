import assert from "node:assert/strict";
import test from "node:test";

import { getHiddenFieldPathsFromModel } from "./denaliUIAdapter";
import {
  denaliRuleSet,
  findDenaliRuleField,
  type DenaliRuleModelCategory,
  type DenaliRuleModelDuration,
} from "./denaliRuleModel";

const PARTICIPANT_PATHS = [
  "participants.minimumAge",
  "participants.fitnessLevel",
  "participants.sportsInsuranceRequired",
] as const;

function modelAt(category: DenaliRuleModelCategory, duration: DenaliRuleModelDuration) {
  const model = denaliRuleSet[category][duration];
  assert.ok(model, `${category}/${duration} model missing`);
  return model;
}

test("denaliRuleSet: each model has unique field paths", () => {
  for (const category of Object.keys(denaliRuleSet) as DenaliRuleModelCategory[]) {
    for (const duration of ["single_day", "multi_day"] as const) {
      const model = denaliRuleSet[category][duration];
      if (model == null) continue;
      const paths = model.fields.map((f) => f.path);
      assert.equal(paths.length, new Set(paths).size, `${category}/${duration} duplicate paths`);
    }
  }
});

test("mountain models: participant paths are visible on denali_pricing", () => {
  const model = modelAt("mountain", "single_day");
  for (const path of PARTICIPANT_PATHS) {
    const field = findDenaliRuleField(model, path);
    assert.ok(field, path);
    assert.equal(field.hidden, false);
    assert.equal(field.required, path !== "participants.sportsInsuranceRequired");
    assert.equal(field.step, "denali_pricing");
  }
});

test("event model: participant paths are hidden on denali_pricing (one row each)", () => {
  const model = modelAt("event", "single_day");
  for (const path of PARTICIPANT_PATHS) {
    const field = findDenaliRuleField(model, path);
    assert.ok(field, path);
    assert.equal(field.hidden, true);
    assert.equal(field.required, false);
    assert.equal(field.step, "denali_pricing");
  }
  const hidden = getHiddenFieldPathsFromModel(model);
  for (const path of PARTICIPANT_PATHS) {
    assert.ok(hidden.includes(path), `expected ${path} in hidden paths`);
  }
});

test("nature model: participant paths hidden like event", () => {
  const model = modelAt("nature", "single_day");
  for (const path of PARTICIPANT_PATHS) {
    assert.equal(findDenaliRuleField(model, path)?.hidden, true, path);
  }
});
