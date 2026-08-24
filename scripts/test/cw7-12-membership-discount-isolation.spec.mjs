/**
 * CW7-12 — membership discount pricing field isolation + capability flag codegen.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import { generateWorkspacePricingCapabilities } from "../codegen/workspace-registry/domains/pricing.mjs";

const ISOLATED_WORKSPACES = ["starter", "guest-club", "urban", "policy-cert"];

/** @param {Record<string, unknown>} overrides */
function syntheticManifest(overrides) {
  return {
    id: "synthetic-pricing-only",
    version: 1,
    package: "@app-tour/workspace-synthetic",
    workspaceTypes: ["synthetic-pricing-only"],
    plugin: { entry: ".", export: "getWorkspacePlugin" },
    ...overrides,
  };
}

describe("cw7-12 membership discount pricing field", () => {
  it("denali manifest declares allowMembershipDiscount capability", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((entry) => entry.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspacePricing?.capabilities?.allowMembershipDiscount, true);
  });

  it("codegen emits allowMembershipDiscount flag for denali", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspacePricingCapabilities(manifests);
    assert.match(generated, /allowMembershipDiscount: true as const/);
    assert.match(generated, /"denali":/);
  });

  it("workspaces without pricing block emit zero capability rows", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspacePricingCapabilities(manifests);
    for (const workspaceId of ISOLATED_WORKSPACES) {
      assert.equal(generated.includes(`"${workspaceId}":`), false);
    }
  });

  it("pricing supported without allowMembershipDiscount emits false flag", () => {
    const manifest = syntheticManifest({
      workspacePricing: {
        supported: true,
        capabilities: { wizardTourField: false, allowMembershipDiscount: false },
      },
    });
    const generated = generateWorkspacePricingCapabilities([manifest]);
    assert.match(generated, /allowMembershipDiscount: false as const/);
    assert.equal(generated.includes('"synthetic-pricing-only":'), true);
  });

  it("pricing with allowMembershipDiscount only emits true flag without wizardTourField", () => {
    const manifest = syntheticManifest({
      workspacePricing: {
        supported: true,
        capabilities: { wizardTourField: false, allowMembershipDiscount: true },
      },
    });
    const generated = generateWorkspacePricingCapabilities([manifest]);
    assert.match(generated, /allowMembershipDiscount: true as const/);
    assert.match(generated, /wizardTourField: false as const/);
  });
});
