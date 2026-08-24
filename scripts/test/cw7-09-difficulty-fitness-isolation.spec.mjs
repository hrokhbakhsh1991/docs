/**
 * CW7-09 — Difficulty/Fitness isolation (zero surface without workspaceDifficultyFitness block).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import {
  generateWorkspaceDifficultyFitnessCapabilities,
  generateWorkspaceDifficultyFitnessFieldModuleBindings,
  generateWorkspaceDifficultyFitnessFilterPresentationBindings,
} from "../codegen/workspace-registry/domains/difficulty-fitness.mjs";

const ISOLATED_WORKSPACES = ["starter", "guest-club", "urban", "policy-cert"];

describe("cw7-09 difficulty-fitness isolation", () => {
  it("workspaces without difficulty-fitness block have zero generated bindings", () => {
    const manifests = discoverManifests();
    const capabilities = generateWorkspaceDifficultyFitnessCapabilities(manifests);
    const fieldBindings = generateWorkspaceDifficultyFitnessFieldModuleBindings(manifests);
    const filterBindings = generateWorkspaceDifficultyFitnessFilterPresentationBindings(manifests);

    for (const workspaceId of ISOLATED_WORKSPACES) {
      const manifest = manifests.find((entry) => entry.id === workspaceId);
      assert.ok(manifest, `missing manifest for ${workspaceId}`);
      const difficultyFitness = manifest.workspaceDifficultyFitness;
      assert.ok(difficultyFitness === undefined || difficultyFitness.supported !== true);

      assert.equal(capabilities.includes(`"${workspaceId}":`), false);
      assert.equal(fieldBindings.includes(`workspaceType: "${workspaceId}"`), false);
      assert.equal(filterBindings.includes(`workspaceType: "${workspaceId}"`), false);
    }
  });

  it("denali retains difficulty-fitness bindings (control)", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((entry) => entry.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceDifficultyFitness?.supported, true);

    const capabilities = generateWorkspaceDifficultyFitnessCapabilities(manifests);
    const fieldBindings = generateWorkspaceDifficultyFitnessFieldModuleBindings(manifests);
    const filterBindings = generateWorkspaceDifficultyFitnessFilterPresentationBindings(manifests);
    assert.match(capabilities, /"denali":/);
    assert.match(fieldBindings, /denaliDifficultyFitnessFieldRegistryFragment/);
    assert.match(filterBindings, /denaliDifficultyFitnessFilterPresentation/);
  });
});
