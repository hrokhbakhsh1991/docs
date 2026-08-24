import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeWorkspaceFieldRegistryWithDifficultyFitnessFragments } from "@app-tour/workspace-sdk";
import { resolveWorkspaceDifficultyFitnessFieldRegistryFragment } from "../../../../apps/web/src/bootstrap/workspace-difficulty-fitness-field-module-bindings.generated";

import {
  denaliDifficultyFitnessFieldRegistryFragment,
  DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH,
} from "../src/field-registry/denali-difficulty-fitness-field-module";
import { buildDenaliWorkspaceFieldRegistry } from "../src/denali-plugin-adapter";

describe("denali-difficulty-fitness-field-parity (CW7-09)", () => {
  it("manifest fieldModule fragment contains difficulty registry row only", () => {
    assert.equal(denaliDifficultyFitnessFieldRegistryFragment.fields.length, 1);
    assert.equal(
      denaliDifficultyFitnessFieldRegistryFragment.fields[0]?.canonicalPath,
      DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH
    );
  });

  it("fragment matches full registry difficulty row (Denali parity golden)", () => {
    const fullRegistry = buildDenaliWorkspaceFieldRegistry();
    const difficultyFromFull = fullRegistry.fields.find(
      (field) => field.canonicalPath === DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH
    );
    assert.ok(difficultyFromFull);
    assert.deepEqual(denaliDifficultyFitnessFieldRegistryFragment.fields[0], difficultyFromFull);
  });

  it("codegen binding resolves denali fragment; starter isolated", () => {
    const denaliFragment = resolveWorkspaceDifficultyFitnessFieldRegistryFragment("denali");
    assert.ok(denaliFragment);
    assert.equal(denaliFragment?.fields.length, 1);
    assert.equal(resolveWorkspaceDifficultyFitnessFieldRegistryFragment("starter"), undefined);
    assert.equal(resolveWorkspaceDifficultyFitnessFieldRegistryFragment("urban"), undefined);
    assert.equal(resolveWorkspaceDifficultyFitnessFieldRegistryFragment("guest-club"), undefined);
  });

  it("merge seam replaces difficulty row without duplicating ids", () => {
    const base = buildDenaliWorkspaceFieldRegistry();
    const merged = mergeWorkspaceFieldRegistryWithDifficultyFitnessFragments(
      base,
      denaliDifficultyFitnessFieldRegistryFragment
    );
    assert.equal(merged.fields.length, base.fields.length);
    const difficultyMerged = merged.fields.find(
      (field) => field.canonicalPath === DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH
    );
    assert.ok(difficultyMerged);
    assert.deepEqual(difficultyMerged, denaliDifficultyFitnessFieldRegistryFragment.fields[0]);
  });
});
