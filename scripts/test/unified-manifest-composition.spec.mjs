import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expandAuthorManifest, loadProfileCatalog } from "../codegen/workspace-registry/domains/profile-expansion.mjs";

describe("unified manifest composition (CW-WAVE-6C)", () => {
  it("profile + workspaceEquipment + workspacePolicy coexist on effective manifest", () => {
    const catalog = loadProfileCatalog();
    const authorManifest = {
      id: "unified-cert",
      version: 1,
      package: "@app-tour/workspace-unified-cert",
      profile: "starter-outdoor",
      workspaceTypes: ["unified-cert"],
      plugin: { entry: "./plugin", export: "getWorkspacePlugin" },
      catalogRegistrationFlow: {
        surfaceExport: "unifiedCertCatalogRegistrationFlowSurface",
      },
      workspaceEquipment: {
        supported: false,
      },
      workspacePolicy: {
        module: "./policy/tour-policy",
        export: "createTourWorkspacePolicyValidator",
      },
    };

    const { effective } = expandAuthorManifest(authorManifest, catalog);

    assert.equal(effective.profile, undefined);
    assert.equal(
      /** @type {Record<string, unknown>} */ (effective.workspaceBooking)?.supported,
      true
    );
    assert.equal(
      /** @type {Record<string, unknown>} */ (effective.workspaceFinance)?.supported,
      true
    );
    assert.equal(
      /** @type {Record<string, unknown>} */ (effective.workspaceEquipment)?.supported,
      false
    );
    assert.equal(
      /** @type {Record<string, unknown>} */ (effective.workspacePolicy)?.export,
      "createTourWorkspacePolicyValidator"
    );
    assert.equal(
      /** @type {Record<string, unknown>} */ (effective.catalogRegistrationFlow)?.surfaceExport,
      "unifiedCertCatalogRegistrationFlowSurface"
    );
  });
});
