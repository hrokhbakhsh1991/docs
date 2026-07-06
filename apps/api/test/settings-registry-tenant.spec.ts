/**
 * P15-P-B1 — tenant-aware settings registry resolution
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";
import { URBAN_SMOKE_TENANT_ID } from "@app-tour/workspace-urban";
import {
  operatorCapabilitySupportsReconciliationTriage,
  operatorCapabilitySupportsUsersDirectory,
} from "@app-tour/workspace-sdk";

import {
  SettingsConfigUnknownError,
  listSettingsModuleMetadataForTenant,
  resolveSettingsModuleByConfigKeyForTenant,
} from "../src/settings/settings-registry";
import { listSettingsModules } from "../src/settings/settings.service";
import { assertOperatorUsersWorkspace, UsersWorkspaceForbiddenError } from "../src/identity/users-workspace-guard";
import { resolveWorkspaceTypeForTenant } from "../src/tenant/resolve-workspace-type";

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

  it("API-C1-01 denali operatorCapabilities enable users directory", async () => {
    const workspaceType = await resolveWorkspaceTypeForTenant(DENALI_SMOKE_TENANT_ID);
    assert.equal(operatorCapabilitySupportsUsersDirectory(workspaceType), true);
    await assert.doesNotReject(() => assertOperatorUsersWorkspace(DENALI_SMOKE_TENANT_ID));
  });

  it("API-C1-02 urban operatorCapabilities block users directory", async () => {
    const workspaceType = await resolveWorkspaceTypeForTenant(URBAN_SMOKE_TENANT_ID);
    assert.equal(operatorCapabilitySupportsUsersDirectory(workspaceType), false);
    await assert.rejects(
      () => assertOperatorUsersWorkspace(URBAN_SMOKE_TENANT_ID),
      (error: unknown) => {
        assert.ok(error instanceof UsersWorkspaceForbiddenError);
        return true;
      }
    );
  });

  it("API-C1-03 reconciliation triage follows operatorCapabilities", async () => {
    const denaliType = await resolveWorkspaceTypeForTenant(DENALI_SMOKE_TENANT_ID);
    const urbanType = await resolveWorkspaceTypeForTenant(URBAN_SMOKE_TENANT_ID);
    assert.equal(operatorCapabilitySupportsReconciliationTriage(denaliType), true);
    assert.equal(operatorCapabilitySupportsReconciliationTriage(urbanType), false);
  });

  it("API-C1-04 urban listSettingsModules includes wizard template from registry", async () => {
    const response = await listSettingsModules({
      userId: "api-c1-urban-modules",
      tenantId: URBAN_SMOKE_TENANT_ID,
      role: "owner",
      status: "ACTIVE",
    });
    const ids = response.items.map((entry) => entry.id);
    assert.ok(ids.includes("account_profile"));
    assert.ok(ids.includes("tour_wizard_template"));
    assert.equal(ids.includes("reconciliation_triage"), false);
    assert.equal(ids.includes("equipment"), false);
  });
});
