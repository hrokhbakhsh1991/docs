/**
 * Phase 8.1 — Web urban settings access guard (CP-8.1-04)
 * Authority: docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md § Web layer
 * Implementation target: apps/web/src/urban/urban-settings-access.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTenantAuthz } from "@app-tour/workspace-sdk/auth";

import {
  CANLOAD_URBAN_SETTINGS_PLUGIN_ID,
  canLoadUrbanSettings,
  resolveUrbanSettingsPageBranch,
  URBAN_SETTINGS_FORBIDDEN_DOM,
} from "../src/urban/urban-settings-access";

const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const URBAN_WORKSPACE_ID = "00000000-0000-4000-8000-000000000403";
const STARTER_TENANT_ID = "00000000-0000-4000-8000-000000000001";

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      assert.equal(actual, expected);
    },
  };
}

function authzFor(role: "owner" | "admin" | "member", tenantId = URBAN_TENANT_ID) {
  return buildTenantAuthz({
    userId: `web-${role}`,
    tenantId,
    role,
    status: "ACTIVE",
    workspaceId: URBAN_WORKSPACE_ID,
  });
}

describe("Phase 8.1 web urban settings access", () => {
  it("WEB-8.1-01 owner can load urban settings page branch", () => {
    const branch = resolveUrbanSettingsPageBranch({
      authz: authzFor("owner"),
      tenantId: URBAN_TENANT_ID,
      workspaceId: URBAN_WORKSPACE_ID,
      workspaceType: "urban",
      pluginId: CANLOAD_URBAN_SETTINGS_PLUGIN_ID,
    });
    expect(branch.kind).toBe("allowed");
  });

  it("WEB-8.1-02 member receives forbidden branch for urban settings", () => {
    const branch = resolveUrbanSettingsPageBranch({
      authz: authzFor("member"),
      tenantId: URBAN_TENANT_ID,
      workspaceId: URBAN_WORKSPACE_ID,
      workspaceType: "urban",
      pluginId: CANLOAD_URBAN_SETTINGS_PLUGIN_ID,
    });
    expect(branch.kind).toBe("forbidden");
  });

  it("WEB-8.1-03 admin receives forbidden branch for urban settings", () => {
    const branch = resolveUrbanSettingsPageBranch({
      authz: authzFor("admin"),
      tenantId: URBAN_TENANT_ID,
      workspaceId: URBAN_WORKSPACE_ID,
      workspaceType: "urban",
      pluginId: CANLOAD_URBAN_SETTINGS_PLUGIN_ID,
    });
    expect(branch.kind).toBe("forbidden");
  });

  it("WEB-8.1-04 starter workspace owner cannot load urban settings", () => {
    expect(
      canLoadUrbanSettings({
        authz: authzFor("owner", STARTER_TENANT_ID),
        tenantId: STARTER_TENANT_ID,
        workspaceId: URBAN_WORKSPACE_ID,
        workspaceType: "starter",
        pluginId: CANLOAD_URBAN_SETTINGS_PLUGIN_ID,
      }),
    ).toBe(false);
  });

  it("WEB-8.1-05 forbidden DOM contract exposes 403 alert surface", () => {
    expect(URBAN_SETTINGS_FORBIDDEN_DOM["data-status-code"]).toBe("403");
    expect(URBAN_SETTINGS_FORBIDDEN_DOM.role).toBe("alert");
  });
});
