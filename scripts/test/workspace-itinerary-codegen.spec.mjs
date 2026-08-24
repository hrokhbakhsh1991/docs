/**
 * CW7-10 — workspace itinerary codegen bindings.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import {
  generateWorkspaceItineraryCapabilities,
  generateWorkspaceItineraryFieldModuleBindings,
  generateWorkspaceItineraryWizardCompositeBindings,
} from "../codegen/workspace-registry/domains/itinerary.mjs";

describe("workspace itinerary codegen (CW7-10)", () => {
  it("emits denali capability flags from workspaceItinerary block", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((manifest) => manifest.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceItinerary?.supported, true);

    const generated = generateWorkspaceItineraryCapabilities(manifests);
    assert.match(generated, /wizardTourField: true as const/);
    assert.match(generated, /catalogDetailSection: true as const/);
    assert.match(generated, /"denali":/);
  });

  it("emits denali field module and wizard composite bindings", () => {
    const manifests = discoverManifests();
    const fieldModule = generateWorkspaceItineraryFieldModuleBindings(manifests);
    const wizardComposite = generateWorkspaceItineraryWizardCompositeBindings(manifests);

    assert.match(fieldModule, /denaliItineraryFieldRegistryFragment/);
    assert.match(wizardComposite, /denaliItineraryWizardCompositeBinding/);
    assert.match(fieldModule, /resolveWorkspaceItineraryFieldRegistryFragment/);
    assert.match(wizardComposite, /resolveWorkspaceItineraryWizardCompositeBinding/);
  });

  it("isolates workspaces without itinerary block", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceItineraryCapabilities(manifests);
    const fieldModule = generateWorkspaceItineraryFieldModuleBindings(manifests);

    for (const workspaceId of ["starter", "urban", "guest-club"]) {
      assert.equal(generated.includes(`"${workspaceId}":`), false);
      assert.equal(fieldModule.includes(`workspaceType: "${workspaceId}"`), false);
    }
  });
});
