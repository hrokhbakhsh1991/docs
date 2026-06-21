/**
 * P15-P-B1 — tenant-aware settings registry resolution
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";
import { URBAN_SMOKE_TENANT_ID } from "@app-tour/workspace-urban";

import {
  SettingsConfigUnknownError,
  listSettingsModuleMetadataForTenant,
  resolveSettingsModuleByConfigKeyForTenant,
} from "../src/settings/settings-registry";

describe("settings-registry-tenant.spec.ts — P15-P-B1", () => {
  it("API-P15-B1-01 urban tenant resolves wizard_template config module", async () => {
    const module = await resolveSettingsModuleByConfigKeyForTenant(
      URBAN_SMOKE_TENANT_ID,
      "wizard_template"
    );
    assert.equal(module.id, "tour_wizard_template");
    assert.equal(module.kind, "tenant_config");
    assert.equal(module.configKey, "wizard_template");
  });

  it("API-P15-B1-02 denali tenant lists multiple operator settings modules", async () => {
    const modules = await listSettingsModuleMetadataForTenant(DENALI_SMOKE_TENANT_ID);
    assert.ok(modules.length > 1);
    const ids = modules.map((entry) => entry.id);
    assert.ok(ids.includes("tour_wizard_template"));
    assert.ok(ids.includes("equipment"));
  });

  it("API-P15-B1-03 unknown config key throws SettingsConfigUnknownError", async () => {
    await assert.rejects(
      () => resolveSettingsModuleByConfigKeyForTenant(URBAN_SMOKE_TENANT_ID, "presets_advanced"),
      (error: unknown) => {
        assert.ok(error instanceof SettingsConfigUnknownError);
        assert.equal(error.configKey, "presets_advanced");
        return true;
      }
    );
  });
});
