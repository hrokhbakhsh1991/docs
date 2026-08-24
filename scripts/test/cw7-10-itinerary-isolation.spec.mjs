/**
 * CW7-10 — itinerary isolation (zero surface without workspaceItinerary block).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import {
  generateWorkspaceItineraryCapabilities,
  generateWorkspaceItineraryFieldModuleBindings,
  generateWorkspaceItineraryWizardCompositeBindings,
} from "../codegen/workspace-registry/domains/itinerary.mjs";

const ISOLATED_WORKSPACES = ["starter", "guest-club", "urban", "policy-cert"];

describe("cw7-10 itinerary isolation", () => {
  it("workspaces without itinerary block have zero generated bindings", () => {
    const manifests = discoverManifests();
    const capabilities = generateWorkspaceItineraryCapabilities(manifests);
    const fieldBindings = generateWorkspaceItineraryFieldModuleBindings(manifests);
    const compositeBindings = generateWorkspaceItineraryWizardCompositeBindings(manifests);

    for (const workspaceId of ISOLATED_WORKSPACES) {
      const manifest = manifests.find((entry) => entry.id === workspaceId);
      assert.ok(manifest, `missing manifest for ${workspaceId}`);
      const itinerary = manifest.workspaceItinerary;
      assert.ok(itinerary === undefined || itinerary.supported !== true);

      assert.equal(capabilities.includes(`"${workspaceId}":`), false);
      assert.equal(fieldBindings.includes(`workspaceType: "${workspaceId}"`), false);
      assert.equal(compositeBindings.includes(`workspaceType: "${workspaceId}"`), false);
    }
  });

  it("denali retains itinerary bindings (control)", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((entry) => entry.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceItinerary?.supported, true);

    const capabilities = generateWorkspaceItineraryCapabilities(manifests);
    const fieldBindings = generateWorkspaceItineraryFieldModuleBindings(manifests);
    const compositeBindings = generateWorkspaceItineraryWizardCompositeBindings(manifests);
    assert.match(capabilities, /"denali":/);
    assert.match(fieldBindings, /denaliItineraryFieldRegistryFragment/);
    assert.match(compositeBindings, /denaliItineraryWizardCompositeBinding/);
  });
});
