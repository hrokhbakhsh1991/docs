/**
 * CW7-11 — workspace pricing codegen bindings.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import {
  generateWorkspacePricingCapabilities,
  generateWorkspacePricingFieldModuleBindings,
  generateWorkspacePricingWizardCompositeBindings,
} from "../codegen/workspace-registry/domains/pricing.mjs";

describe("workspace pricing codegen (CW7-11)", () => {
  it("emits denali capability flags from workspacePricing block", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((manifest) => manifest.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspacePricing?.supported, true);

    const generated = generateWorkspacePricingCapabilities(manifests);
    assert.match(generated, /wizardTourField: true as const/);
    assert.match(generated, /"denali":/);
  });

  it("emits denali field module and wizard composite bindings", () => {
    const manifests = discoverManifests();
    const fieldModule = generateWorkspacePricingFieldModuleBindings(manifests);
    const wizardComposite = generateWorkspacePricingWizardCompositeBindings(manifests);

    assert.match(fieldModule, /denaliPricingFieldRegistryFragment/);
    assert.match(wizardComposite, /denaliPricingWizardCompositeBinding/);
    assert.match(fieldModule, /resolveWorkspacePricingFieldRegistryFragment/);
    assert.match(wizardComposite, /resolveWorkspacePricingWizardCompositeBinding/);
  });

  it("isolates workspaces without pricing block", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspacePricingCapabilities(manifests);
    const fieldModule = generateWorkspacePricingFieldModuleBindings(manifests);

    for (const workspaceId of ["starter", "urban", "guest-club"]) {
      assert.equal(generated.includes(`"${workspaceId}":`), false);
      assert.equal(fieldModule.includes(`workspaceType: "${workspaceId}"`), false);
    }
  });
});
