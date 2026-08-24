/**
 * CW7-08 — transport isolation (zero surface without workspaceTransport block).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import {
  generateCatalogIntakeTransportSurfaceBindings,
  generateCatalogTransportSnapshotReaderBindings,
  generateRegistrationTransportNormalizerBindings,
  generateWorkspaceRegistrationTransportInitializers,
  generateWorkspaceTransportCapabilities,
  generateWorkspaceTransportFieldModuleBindings,
  generateWorkspaceTransportWizardCompositeBindings,
} from "../codegen/workspace-registry/domains/transport.mjs";

const ISOLATED_WORKSPACES = ["starter", "guest-club", "urban", "policy-cert"];

describe("cw7-08 transport isolation", () => {
  it("workspaces without transport block have zero generated bindings", () => {
    const manifests = discoverManifests();
    const capabilities = generateWorkspaceTransportCapabilities(manifests);
    const snapshot = generateCatalogTransportSnapshotReaderBindings(manifests);
    const intake = generateCatalogIntakeTransportSurfaceBindings(manifests);
    const normalizers = generateRegistrationTransportNormalizerBindings(manifests);
    const initializers = generateWorkspaceRegistrationTransportInitializers(manifests);
    const fieldBindings = generateWorkspaceTransportFieldModuleBindings(manifests);
    const compositeBindings = generateWorkspaceTransportWizardCompositeBindings(manifests);

    for (const workspaceId of ISOLATED_WORKSPACES) {
      const manifest = manifests.find((entry) => entry.id === workspaceId);
      assert.ok(manifest, `missing manifest for ${workspaceId}`);
      const transport = manifest.workspaceTransport;
      assert.ok(transport === undefined || transport.supported !== true);

      assert.equal(capabilities.includes(`"${workspaceId}":`), false);
      assert.equal(snapshot.includes(`workspaceType: "${workspaceId}"`), false);
      assert.equal(intake.includes(`workspaceType: "${workspaceId}"`), false);
      assert.equal(normalizers.includes(`workspaceType: "${workspaceId}"`), false);
      assert.equal(initializers.includes(`workspaceType: "${workspaceId}"`), false);
      assert.equal(fieldBindings.includes(`workspaceType: "${workspaceId}"`), false);
      assert.equal(compositeBindings.includes(`workspaceType: "${workspaceId}"`), false);
    }
  });

  it("denali retains transport bindings including CW7-07 field module + composite (control)", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((entry) => entry.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceTransport?.supported, true);
    assert.equal(denali.workspaceTransport?.capabilities?.wizardTourField, true);

    const capabilities = generateWorkspaceTransportCapabilities(manifests);
    const snapshot = generateCatalogTransportSnapshotReaderBindings(manifests);
    const fieldBindings = generateWorkspaceTransportFieldModuleBindings(manifests);
    const compositeBindings = generateWorkspaceTransportWizardCompositeBindings(manifests);
    assert.match(capabilities, /"denali":/);
    assert.match(capabilities, /wizardTourField: true as const/);
    assert.match(snapshot, /"denali"/);
    assert.match(fieldBindings, /denaliTransportFieldRegistryFragment/);
    assert.match(compositeBindings, /denaliTransportModeCompositeBinding/);
  });
});
