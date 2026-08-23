/**
 * CW6-05A — profile-cert theme/intake/config override proof.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  expandAuthorManifest,
  loadProfileCatalog,
} from "../codegen/workspace-registry/domains/profile-expansion.mjs";

const MANIFEST_PATH = join(process.cwd(), "scripts/test/fixtures/profile-cert.manifest.json");

describe("profile-cert (CW6-05A)", () => {
  it("overrides branding, intake fields, and catalog config via declarative seams only", () => {
    const author = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    assert.equal(author.profile, "starter-outdoor");
    assert.equal(author.workspacePolicy?.module, "./policy/tour-policy");

    const catalog = loadProfileCatalog();
    const { effective, audit } = expandAuthorManifest(author, catalog);

    assert.equal(audit?.profileId, "starter-outdoor");
    assert.ok(audit?.overriddenPaths?.includes("tenantBrandingDefaults.primaryColor"));
    assert.ok(audit?.overriddenPaths?.includes("catalogPresentation.listFeatures.cityFilter"));
    assert.ok(audit?.overriddenPaths?.includes("memberProfile.editableFields"));
    assert.equal(effective.tenantBrandingDefaults?.primaryColor, "#0d9488");
    assert.equal(effective.catalogPresentation?.listFeatures?.cityFilter, true);
    assert.equal(effective.catalogPresentation?.detailSections?.difficulty, false);
    assert.deepEqual(effective.memberProfile?.editableFields, ["displayName"]);
    assert.deepEqual(effective.memberProfile?.readOnlyFields, ["email", "mobile"]);
    assert.equal(effective.catalogRegistrationFlow?.steps?.components?.intake, "ProfileCertIntakeStep");
    assert.equal(effective.workspaceBooking?.supported, true);
    assert.equal(effective.workspaceFinance?.supported, true);
    assert.equal(effective.workspaceEquipment?.supported, false);
    assert.equal(effective.workspacePolicy?.module, "./policy/tour-policy");
    assert.equal(effective.workspacePolicy?.export, "createTourWorkspacePolicyValidator");
    assert.equal(effective.profile, undefined);
  });
});
