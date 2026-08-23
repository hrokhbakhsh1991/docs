/**
 * CW6-06 — profile certification: manifest → exact capability set after expansion.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  expandAuthorManifest,
  loadProfileCatalog,
} from "../codegen/workspace-registry/domains/profile-expansion.mjs";

const STARTER_OUTDOOR_CAPABILITY_KEYS = [
  "catalogPresentation",
  "catalogRegistrationFlow",
  "memberProfile",
  "tenantBrandingDefaults",
  "workspaceBooking",
  "workspaceFinance",
];

function sortedCapabilityKeys(effective) {
  return Object.keys(effective)
    .filter(
      (key) =>
        ![
          "id",
          "version",
          "package",
          "workspaceTypes",
          "plugin",
          "web",
          "pluginApiVersion",
          "guestExtensionsVersion",
          "themeStylesheets",
        ].includes(key)
    )
    .sort();
}

describe("profile certification (CW6-06)", () => {
  it("starter-outdoor expands to exact RC capability set", () => {
    const catalog = loadProfileCatalog();
    const { effective } = expandAuthorManifest(
      {
        id: "outdoor-cert",
        profile: "starter-outdoor",
        package: "@app-tour/workspace-starter",
        workspaceTypes: ["outdoor-cert"],
        plugin: { entry: ".", export: "getWorkspacePlugin" },
      },
      catalog
    );

    assert.deepEqual(sortedCapabilityKeys(effective), STARTER_OUTDOOR_CAPABILITY_KEYS);
    assert.equal(effective.workspaceEquipment, undefined);
    assert.equal(effective.workspacePolicy, undefined);
  });

  it("profile-cert fixture preserves certified set with author overrides", () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "scripts/test/fixtures/profile-cert.manifest.json"), "utf8")
    );
    const catalog = loadProfileCatalog();
    const { effective } = expandAuthorManifest(manifest, catalog);

    assert.deepEqual(sortedCapabilityKeys(effective), [
      ...STARTER_OUTDOOR_CAPABILITY_KEYS,
      "workspaceEquipment",
      "workspacePolicy",
    ].sort());
    assert.equal(effective.tenantBrandingDefaults?.primaryColor, "#0d9488");
    assert.equal(effective.catalogPresentation?.listFeatures?.cityFilter, true);
    assert.equal(effective.workspaceEquipment?.supported, false);
  });
});
