import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectProfileOverridePaths,
  deepMergeProfileDefaults,
  expandAuthorManifest,
  loadProfileCatalog,
} from "../codegen/workspace-registry/domains/profile-expansion.mjs";

describe("profile-expansion merge (CW6-02)", () => {
  it("author scalar wins over profile default", () => {
    const merged = deepMergeProfileDefaults(
      { tenantBrandingDefaults: { primaryColor: "#2563eb" } },
      { tenantBrandingDefaults: { primaryColor: "#0d9488" } }
    );
    assert.deepEqual(merged, { tenantBrandingDefaults: { primaryColor: "#0d9488" } });
  });

  it("author array replaces profile array entirely", () => {
    const merged = deepMergeProfileDefaults(
      { workspaceTypes: ["starter"] },
      { workspaceTypes: ["cert-club", "starter"] }
    );
    assert.deepEqual(merged.workspaceTypes, ["cert-club", "starter"]);
  });

  it("records overridden paths for audit", () => {
    const profileDefaults = {
      catalogPresentation: { listFeatures: { cityFilter: false } },
      tenantBrandingDefaults: { primaryColor: "#2563eb" },
    };
    const author = {
      id: "cert-club",
      tenantBrandingDefaults: { primaryColor: "#0d9488" },
    };
    const paths = collectProfileOverridePaths(profileDefaults, author);
    assert.deepEqual(paths, ["tenantBrandingDefaults.primaryColor"]);
  });

  it("resolves starter-outdoor profile catalog entry", () => {
    const catalog = loadProfileCatalog();
    assert.ok(catalog.has("starter-outdoor"));
    const { effective, audit } = expandAuthorManifest(
      {
        id: "cert-club",
        profile: "starter-outdoor",
        package: "@app-tour/workspace-cert-club",
        workspaceTypes: ["cert-club"],
        plugin: { entry: ".", export: "getWorkspacePlugin" },
        tenantBrandingDefaults: { primaryColor: "#0d9488" },
      },
      catalog
    );
    assert.equal(audit?.profileId, "starter-outdoor");
    assert.equal(effective.profile, undefined);
    assert.equal(
      /** @type {Record<string, unknown>} */ (effective.tenantBrandingDefaults).primaryColor,
      "#0d9488"
    );
    assert.equal(
      /** @type {Record<string, unknown>} */ (effective.workspaceBooking)?.supported,
      true
    );
  });

  it("fails fast on missing profile id", () => {
    assert.throws(
      () =>
        expandAuthorManifest(
          { id: "missing", profile: "does-not-exist" },
          loadProfileCatalog()
        ),
      /PROFILE_NOT_FOUND/
    );
  });
});
