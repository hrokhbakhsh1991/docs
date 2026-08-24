import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_FIELD_DEFINITIONS } from "../src/field-registry/denaliFieldRegistryData";
import {
  DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH,
  DENALI_FITNESS_LEVEL_CANONICAL_PATH,
  denaliDifficultyFitnessFieldModule,
} from "../src/field-registry/denali-difficulty-fitness-tour-field-module";

describe("denali-difficulty-fitness-parity.golden.spec (CW7-09)", () => {
  it("tour-field module matches denaliFieldRegistryData difficulty row", () => {
    const difficultyRow = DENALI_FIELD_DEFINITIONS.find(
      (row) => row.canonicalPath === DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH
    );
    assert.ok(difficultyRow);

    const fragmentField = denaliDifficultyFitnessFieldModule.fields[0];
    assert.equal(fragmentField.canonicalPath, difficultyRow.canonicalPath);
    assert.equal(fragmentField.stepId, difficultyRow.stepId);
    assert.equal(fragmentField.rhfPath, difficultyRow.rhfPath);
    assert.equal(fragmentField.zodPath, difficultyRow.zodPath);
    assert.equal(fragmentField.zodKind, difficultyRow.zodKind);
    assert.deepEqual(fragmentField.tags, difficultyRow.tags);
    assert.deepEqual(fragmentField.ruleDefaults, difficultyRow.ruleDefaults);
  });

  it("tour-field module matches denaliFieldRegistryData fitness row", () => {
    const fitnessRow = DENALI_FIELD_DEFINITIONS.find(
      (row) => row.canonicalPath === DENALI_FITNESS_LEVEL_CANONICAL_PATH
    );
    assert.ok(fitnessRow);

    const fragmentField = denaliDifficultyFitnessFieldModule.fields[1];
    assert.equal(fragmentField.canonicalPath, fitnessRow.canonicalPath);
    assert.equal(fragmentField.stepId, fitnessRow.stepId);
    assert.equal(fragmentField.rhfPath, fitnessRow.rhfPath);
    assert.equal(fragmentField.zodPath, fitnessRow.zodPath);
    assert.equal(fragmentField.zodKind, fitnessRow.zodKind);
    assert.deepEqual(fragmentField.tags, fitnessRow.tags);
    assert.deepEqual(fragmentField.ruleDefaults, fitnessRow.ruleDefaults);
  });

  it("field module exposes workspaceDifficultyFitness.tourField id", () => {
    assert.equal(denaliDifficultyFitnessFieldModule.moduleId, "workspaceDifficultyFitness.tourField");
    assert.equal(denaliDifficultyFitnessFieldModule.fields.length, 2);
  });
});
