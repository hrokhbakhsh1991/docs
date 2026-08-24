/**
 * CW7-06 — transport isolation (zero surface without workspaceTransport block).
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
} from "../codegen/workspace-registry/domains/transport.mjs";

const ISOLATED_WORKSPACES = ["starter", "guest-club", "urban", "policy-cert"];

describe("cw7-06 transport isolation", () => {
  it("workspaces without transport block have zero generated bindings", () => {
    const manifests = discoverManifests();
    const capabilities = generateWorkspaceTransportCapabilities(manifests);
    const snapshot = generateCatalogTransportSnapshotReaderBindings(manifests);
    const intake = generateCatalogIntakeTransportSurfaceBindings(manifests);
    const normalizers = generateRegistrationTransportNormalizerBindings(manifests);
    const initializers = generateWorkspaceRegistrationTransportInitializers(manifests);

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
    }
  });

  it("denali retains transport bindings (control)", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((entry) => entry.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceTransport?.supported, true);

    const capabilities = generateWorkspaceTransportCapabilities(manifests);
    const snapshot = generateCatalogTransportSnapshotReaderBindings(manifests);
    assert.match(capabilities, /"denali":/);
    assert.match(snapshot, /"denali"/);
  });
});
