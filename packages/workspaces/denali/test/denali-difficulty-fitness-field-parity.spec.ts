import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeWorkspaceFieldRegistryWithDifficultyFitnessFragments } from "../../../workspace-sdk/src/registry/merge-workspace-field-registry-with-difficulty-fitness-fragments.ts";

import {
  denaliDifficultyFitnessFieldRegistryFragment,
  DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH,
  DENALI_FITNESS_LEVEL_CANONICAL_PATH,
} from "../src/field-registry/denali-difficulty-fitness-field-module";
import { buildDenaliWorkspaceFieldRegistry } from "../src/denali-plugin-adapter";

describe("denali-difficulty-fitness-field-parity (CW7-09)", () => {
  it("manifest fieldModule fragment contains difficulty registry row", () => {
    assert.equal(denaliDifficultyFitnessFieldRegistryFragment.fields.length, 1);
    assert.equal(
      denaliDifficultyFitnessFieldRegistryFragment.fields[0]?.canonicalPath,
      DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH
    );
  });

  it("fragment matches full registry difficulty row (Denali parity golden)", () => {
    const fullRegistry = buildDenaliWorkspaceFieldRegistry();
    for (const fragmentField of denaliDifficultyFitnessFieldRegistryFragment.fields) {
      const fromFull = fullRegistry.fields.find((field) => field.id === fragmentField.id);
      assert.ok(fromFull, `missing registry row for ${fragmentField.id}`);
      assert.deepEqual(fragmentField, fromFull);
    }
  });

  it("merge seam replaces difficulty row without duplicating ids", () => {
    const base = buildDenaliWorkspaceFieldRegistry();
    const merged = mergeWorkspaceFieldRegistryWithDifficultyFitnessFragments(
      base,
      denaliDifficultyFitnessFieldRegistryFragment
    );
    assert.equal(merged.fields.length, base.fields.length);
    for (const fragmentField of denaliDifficultyFitnessFieldRegistryFragment.fields) {
      const mergedRow = merged.fields.find((field) => field.id === fragmentField.id);
      assert.ok(mergedRow);
      assert.deepEqual(mergedRow, fragmentField);
    }
  });
});
