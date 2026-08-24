import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import {
  generateWorkspaceDifficultyFitnessCapabilities,
  generateWorkspaceDifficultyFitnessFieldModuleBindings,
  generateWorkspaceDifficultyFitnessFilterPresentationBindings,
} from "../codegen/workspace-registry/domains/difficulty-fitness.mjs";

describe("workspace difficulty-fitness codegen (CW7-09)", () => {
  it("emits denali capability flags from workspaceDifficultyFitness block", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((manifest) => manifest.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceDifficultyFitness?.supported, true);

    const generated = generateWorkspaceDifficultyFitnessCapabilities(manifests);
    assert.match(generated, /wizardTourField: true as const/);
    assert.match(generated, /catalogDetailSection: true as const/);
    assert.match(generated, /catalogListFilters: true as const/);
    assert.match(generated, /catalogMarketingFilters: true as const/);
    assert.match(generated, /"denali":/);
  });

  it("isolates workspaces without difficulty-fitness block", () => {
    const manifests = discoverManifests();
    const starter = manifests.find((manifest) => manifest.id === "starter");
    assert.ok(starter);
    assert.equal(starter.workspaceDifficultyFitness, undefined);

    const generated = generateWorkspaceDifficultyFitnessCapabilities(manifests);
    for (const workspaceId of ["starter", "urban", "guest-club"]) {
      assert.equal(generated.includes(`"${workspaceId}":`), false);
    }
  });

  it("emits denali fieldModule binding when wizardTourField enabled (CW7-09)", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((manifest) => manifest.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceDifficultyFitness?.capabilities?.wizardTourField, true);
    assert.ok(denali.workspaceDifficultyFitness?.fieldModule);

    const generated = generateWorkspaceDifficultyFitnessFieldModuleBindings(manifests);
    assert.match(generated, /denaliDifficultyFitnessFieldRegistryFragment/);
    assert.match(generated, /"denali"/);
    assert.match(generated, /resolveWorkspaceDifficultyFitnessFieldRegistryFragment/);
  });

  it("emits denali filterPresentation when catalogMarketingFilters enabled (CW7-09)", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((manifest) => manifest.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceDifficultyFitness?.capabilities?.catalogMarketingFilters, true);
    assert.ok(denali.workspaceDifficultyFitness?.filterPresentation);

    const generated = generateWorkspaceDifficultyFitnessFilterPresentationBindings(manifests);
    assert.match(generated, /denaliDifficultyFitnessFilterPresentation/);
    assert.match(generated, /"denali"/);
    assert.match(generated, /resolveWorkspaceDifficultyFitnessFilterPresentation/);
    assert.match(generated, /denaliDifficultyFitnessFilterPresentation/);
  });
});
