/**
 * P15-P-B1 — urban operator settings manifest
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getUrbanWorkspacePlugin } from "../src/urban.plugin";
import { getUrbanOperatorSettingsSurface } from "../src/settings/urban-settings.manifest";

describe("urban-settings-manifest.spec.ts — P15-P-B1", () => {
  it("URB-SET-01 exposes tour_wizard_template tenant_config module", () => {
    const surface = getUrbanOperatorSettingsSurface();
    const wizardTemplate = surface.modules.find((module) => module.id === "tour_wizard_template");
    assert.ok(wizardTemplate);
    assert.equal(wizardTemplate.kind, "tenant_config");
    assert.equal(wizardTemplate.configKey, "wizard_template");
    assert.equal(getUrbanWorkspacePlugin().operatorSettings?.manifestVersion, 1);
  });
});
