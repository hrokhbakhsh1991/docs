/**
 * Phase 9.6 — SDK settings manifest validation (DEC-P9-009).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateSettingsManifest,
  type SettingsModuleManifest,
} from "../src/operator/settings/settings-module-manifest";
import { getStarterOperatorSettingsSurface } from "../src/reference/starter-settings.manifest";
import { getStarterWorkspacePlugin } from "../src/reference/starter-workspace.plugin";

describe("settings-manifest.spec.ts — workspace-sdk", () => {
  it("SDK-9.6-01 validateSettingsManifest rejects unknown kind", () => {
    const valid: SettingsModuleManifest = {
      id: "equipment",
      kind: "reference_data",
      route: "settings/equipment",
      ability: "operator.settings.equipment",
      nav: { group: "workspace", labelKey: "settings.equipment" },
    };
    assert.doesNotThrow(() => validateSettingsManifest([valid]));
    assert.throws(
      () =>
        validateSettingsManifest([
          {
            ...valid,
            kind: "bogus" as SettingsModuleManifest["kind"],
          },
        ]),
      /SETTINGS_MODULE_UNKNOWN_KIND:bogus/
    );
  });

  it("SDK-9.6-W08 starter manifest exposes tour_wizard_template tenant_config", () => {
    const surface = getStarterOperatorSettingsSurface();
    const wizard = surface.modules.find((module) => module.id === "tour_wizard_template");
    assert.ok(wizard);
    assert.equal(wizard.kind, "tenant_config");
    assert.equal(wizard.configKey, "wizard_template");
    assert.equal(getStarterWorkspacePlugin().operatorSettings?.manifestVersion, 1);
  });
});
