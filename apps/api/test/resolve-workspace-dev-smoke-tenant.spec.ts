/**
 * P0 PR-7b — devBootstrap smoke tenant resolver
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";
import { URBAN_SMOKE_TENANT_ID as URBAN_PACKAGE_SMOKE_TENANT_ID } from "@app-tour/workspace-urban";

import {
  DENALI_SMOKE_SUBDOMAIN,
  DENALI_SMOKE_TENANT_ID as HOST_DENALI_SMOKE_TENANT_ID,
  resolveWorkspaceDevSmokeTenantByTenantId,
  resolveWorkspaceDevSmokeTenant,
  URBAN_SMOKE_SUBDOMAIN,
  URBAN_SMOKE_TENANT_ID as HOST_URBAN_SMOKE_TENANT_ID,
} from "../src/settings/resolve-workspace-dev-smoke-tenant";

describe("resolve-workspace-dev-smoke-tenant.spec.ts — P0 PR-7b", () => {
  it("API-P0-07B-01 resolves denali smoke binding from generated manifest", () => {
    const binding = resolveWorkspaceDevSmokeTenant("denali");
    assert.equal(binding.workspaceId, "denali");
    assert.equal(binding.tenantId, DENALI_SMOKE_TENANT_ID);
    assert.equal(binding.subdomain, "denali");
    assert.equal(HOST_DENALI_SMOKE_TENANT_ID, DENALI_SMOKE_TENANT_ID);
    assert.equal(DENALI_SMOKE_SUBDOMAIN, "denali");
  });

  it("API-P0-07B-02 resolves urban smoke binding from generated manifest", () => {
    const binding = resolveWorkspaceDevSmokeTenant("urban");
    assert.equal(binding.workspaceId, "urban");
    assert.equal(binding.tenantId, URBAN_PACKAGE_SMOKE_TENANT_ID);
    assert.equal(binding.subdomain, "urban");
    assert.equal(HOST_URBAN_SMOKE_TENANT_ID, URBAN_PACKAGE_SMOKE_TENANT_ID);
    assert.equal(URBAN_SMOKE_SUBDOMAIN, "urban");
    assert.equal(resolveWorkspaceDevSmokeTenantByTenantId(binding.tenantId)?.workspaceId, "urban");
  });

  it("API-P0-07B-03 unknown workspace throws", () => {
    assert.throws(
      () => resolveWorkspaceDevSmokeTenant("starter"),
      /WORKSPACE_DEV_SMOKE_TENANT_NOT_FOUND:starter/
    );
  });
});
