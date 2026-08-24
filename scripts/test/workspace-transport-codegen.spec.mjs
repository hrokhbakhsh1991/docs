/**
 * CW7-06 — workspace transport codegen bindings.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import {
  generateCatalogTransportSnapshotReaderBindings,
  generateWorkspaceRegistrationTransportInitializers,
  generateWorkspaceTransportCapabilities,
} from "../codegen/workspace-registry/domains/transport.mjs";

describe("workspace transport codegen (CW7-06)", () => {
  it("emits denali capability flags from workspaceTransport block", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((manifest) => manifest.id === "denali");
    assert.ok(denali);
    assert.equal(denali.workspaceTransport?.supported, true);

    const generated = generateWorkspaceTransportCapabilities(manifests);
    assert.match(generated, /catalogSnapshot: true as const/);
    assert.match(generated, /registrationInitializer: true as const/);
    assert.match(generated, /"denali":/);
  });

  it("emits denali snapshot reader and registration initializer bindings", () => {
    const manifests = discoverManifests();
    const snapshot = generateCatalogTransportSnapshotReaderBindings(manifests);
    const initializers = generateWorkspaceRegistrationTransportInitializers(manifests);

    assert.match(snapshot, /readDenaliCatalogTransportSnapshot/);
    assert.match(snapshot, /"denali"/);
    assert.match(initializers, /registerDenaliCatalogRegistrationTransportInitializer/);
    assert.match(initializers, /registerWorkspaceRegistrationTransportInitializersFromManifest/);
  });

  it("isolates workspaces without transport block", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceTransportCapabilities(manifests);
    const snapshot = generateCatalogTransportSnapshotReaderBindings(manifests);
    const initializers = generateWorkspaceRegistrationTransportInitializers(manifests);

    for (const workspaceId of ["starter", "urban", "guest-club"]) {
      assert.equal(generated.includes(`"${workspaceId}":`), false);
      assert.equal(snapshot.includes(`workspaceType: "${workspaceId}"`), false);
      assert.equal(initializers.includes(`workspaceType: "${workspaceId}"`), false);
    }
  });
});
