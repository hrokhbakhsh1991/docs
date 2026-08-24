/**
 * CW7-11 — pricing isolation (zero surface without workspacePricing block).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import {
  generateWorkspacePricingCapabilities,
  generateWorkspacePricingFieldModuleBindings,
  generateWorkspacePricingWizardCompositeBindings,
} from "../codegen/workspace-registry/domains/pricing.mjs";

const ISOLATED_WORKSPACES = ["starter", "guest-club", "urban", "policy-cert"];

describe("cw7-11 pricing isolation", () => {
  it("workspaces without pricing block have zero generated bindings", () => {
    const manifests = discoverManifests();
    const capabilities = generateWorkspacePricingCapabilities(manifests);
    const fieldBindings = generateWorkspacePricingFieldModuleBindings(manifests);
    const compositeBindings = generateWorkspacePricingWizardCompositeBindings(manifests);

    for (const workspaceId of ISOLATED_WORKSPACES) {
      const manifest = manifests.find((entry) => entry.id === workspaceId);
      assert.ok(manifest, `missing manifest for ${workspaceId}`);
      const pricing = manifest.workspacePricing;
      assert.ok(pricing === undefined || pricing.supported !== true);

      assert.equal(capabilities.includes(`"${workspaceId}":`), false);
      assert.equal(fieldBindings.includes(`workspaceType: "${workspaceId}"`), false);
      assert.equal(compositeBindings.includes(`workspaceType: "${workspaceId}"`), false);
    }
  });

  it("denali retains pricing bindings (control)", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((entry) => entry.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspacePricing?.supported, true);

    const capabilities = generateWorkspacePricingCapabilities(manifests);
    const fieldBindings = generateWorkspacePricingFieldModuleBindings(manifests);
    const compositeBindings = generateWorkspacePricingWizardCompositeBindings(manifests);
    assert.match(capabilities, /"denali":/);
    assert.match(fieldBindings, /denaliPricingFieldRegistryFragment/);
    assert.match(compositeBindings, /denaliPricingWizardCompositeBinding/);
  });
});
