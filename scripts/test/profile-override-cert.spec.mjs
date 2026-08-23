/**
 * CW6-05A — theme/intake/config override proof on profile-scaffolded workspace.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import {
  expandAuthorManifest,
  loadProfileCatalog,
} from "../codegen/workspace-registry/domains/profile-expansion.mjs";
import {
  generateWorkspaceCatalogListFeatures,
  generateWorkspaceMemberProfileCapabilities,
} from "../generate-workspace-registry.mjs";

const MANIFEST_PATH = join(process.cwd(), "packages/workspaces/profile-cert/workspace.manifest.json");

describe("profile-cert (CW6-05A)", () => {
  it("expands starter-outdoor profile with author theme/intake/config overrides", () => {
    const author = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    assert.equal(author.profile, "starter-outdoor");
    assert.equal(author.workspacePolicy, undefined);

    const catalog = loadProfileCatalog();
    const { effective, audit } = expandAuthorManifest(author, catalog);

    assert.equal(audit?.profileId, "starter-outdoor");
    assert.ok(audit?.overriddenPaths.includes("tenantBrandingDefaults.primaryColor"));
    assert.ok(audit?.overriddenPaths.includes("catalogPresentation.listFeatures.cityFilter"));
    assert.ok(audit?.overriddenPaths.includes("memberProfile.editableFields"));
    assert.ok(audit?.overriddenPaths.includes("catalogRegistrationFlow.steps.components.intake"));

    assert.equal(effective.tenantBrandingDefaults?.primaryColor, "#0d9488");
    assert.equal(effective.catalogPresentation?.listFeatures?.cityFilter, true);
    assert.deepEqual(effective.memberProfile?.editableFields, ["displayName"]);
    assert.equal(effective.catalogRegistrationFlow?.steps?.components?.intake, "ProfileCertIntakeStep");
    assert.equal(effective.workspaceBooking?.supported, false);
    assert.equal(effective.workspaceFinance?.supported, false);
    assert.equal(effective.workspaceEquipment?.supported, false);
  });

  it("codegen consumes effective manifest overrides without host/core edits", () => {
    const manifests = discoverManifests();
    const proof = manifests.find((manifest) => manifest.id === "profile-cert");
    assert.ok(proof);

    const listFeatures = generateWorkspaceCatalogListFeatures(manifests);
    assert.match(listFeatures, /"profile-cert": Object\.freeze\(\{ cityFilter: true/);

    const memberProfile = generateWorkspaceMemberProfileCapabilities(manifests);
    assert.match(memberProfile, /"profile-cert": Object\.freeze\(\{[\s\S]*editableFields: Object\.freeze\(\["displayName"\]/);
  });
});
