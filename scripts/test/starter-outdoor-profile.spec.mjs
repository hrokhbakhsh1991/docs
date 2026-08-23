import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  deepMergeProfileDefaults,
  expandAuthorManifest,
  loadProfileCatalog,
} from "../codegen/workspace-registry/domains/profile-expansion.mjs";

const PROFILE_PATH = join(process.cwd(), "profiles/starter-outdoor.profile.json");

describe("starter-outdoor profile (CW6-03)", () => {
  it("catalog entry is deterministic and excludes Denali-specific semantics", () => {
    const raw = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
    assert.equal(raw.id, "starter-outdoor");
    assert.equal(raw.version, 1);

    const defaults = raw.capabilityDefaults;
    assert.equal(defaults.workspaceBooking?.supported, true);
    assert.equal(defaults.workspaceFinance?.supported, true);
    assert.equal(defaults.catalogRegistrationFlow?.steps?.mode, "compose");
    assert.equal(defaults.catalogRegistrationFlow?.steps?.reuseAuthStepsFrom, "shared");
    assert.equal(defaults.catalogPresentation?.listFeatures?.cityFilter, false);
    assert.equal(defaults.catalogPresentation?.detailSections?.difficulty, true);
    assert.equal(defaults.memberProfile?.editableFields?.includes("nationalId"), false);
    assert.equal(defaults.workspaceEquipment, undefined);
    assert.equal(defaults.workspacePolicy, undefined);
    assert.equal(defaults.catalogPresentation?.priceDisplay, undefined);
    assert.equal(raw.profile, undefined);
  });

  it("expands certified RC capability blocks with author override precedence", () => {
    const catalog = loadProfileCatalog();
    const { effective, audit } = expandAuthorManifest(
      {
        id: "outdoor-cert",
        profile: "starter-outdoor",
        package: "@app-tour/workspace-starter",
        workspaceTypes: ["outdoor-cert"],
        plugin: { entry: ".", export: "getWorkspacePlugin" },
        tenantBrandingDefaults: { primaryColor: "#0d9488" },
      },
      catalog
    );

    assert.equal(audit?.profileId, "starter-outdoor");
    assert.deepEqual(audit?.overriddenPaths, ["tenantBrandingDefaults.primaryColor"]);
    assert.equal(effective.profile, undefined);
    assert.equal(effective.workspaceBooking?.supported, true);
    assert.equal(effective.workspaceFinance?.supported, true);
    assert.equal(effective.catalogRegistrationFlow?.steps?.mode, "compose");
    assert.equal(effective.tenantBrandingDefaults?.primaryColor, "#0d9488");
    assert.equal(effective.workspaceEquipment, undefined);
  });

  it("author manifest replaces profile array fields entirely", () => {
    const merged = deepMergeProfileDefaults(
      { memberProfile: { editableFields: ["displayName", "email"] } },
      { memberProfile: { editableFields: ["displayName"] } }
    );
    assert.deepEqual(merged.memberProfile.editableFields, ["displayName"]);
  });
});
