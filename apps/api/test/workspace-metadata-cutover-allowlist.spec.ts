import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import { stripWorkspacePluginToDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

import { isWorkspaceMetadataEnabledForTenant } from "../src/workspace-metadata/is-workspace-metadata-enabled-for-tenant.ts";
import { isWorkspaceMetadataEnabled } from "../src/workspace-metadata/is-workspace-metadata-enabled.ts";
import { resolveWorkspacePluginForTenant } from "../src/workspace-metadata/load-workspace-plugin-for-tenant.ts";
import {
  toTenantWorkspaceMetadataBinding,
} from "../src/workspace-metadata/read-tenant-workspace-metadata-binding.ts";
import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin.ts";

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  WORKSPACE_METADATA_ENABLED: env.WORKSPACE_METADATA_ENABLED,
  WORKSPACE_METADATA_TENANT_ALLOWLIST: env.WORKSPACE_METADATA_TENANT_ALLOWLIST,
};

afterEach(() => {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
});

describe("workspace-metadata-cutover-allowlist", () => {
  it("CO-01 flag off returns package path even with binding", async () => {
    delete env.WORKSPACE_METADATA_ENABLED;
    const plugin = await resolveWorkspacePluginForTenant({
      workspaceType: "starter",
      tenantId: "tenant-a",
      metadataBinding: { definitionId: "starter-shell", definitionVersion: 1 },
      loadPublishedVersion: async () => {
        throw new Error("should not load metadata when flag off");
      },
    });
    assert.equal(plugin.id, resolveWorkspacePluginForType("starter").id);
  });

  it("CO-02 flag on with empty allowlist uses metadata path when binding set", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;
    const overlay = getStarterWorkspacePlugin();
    const payload = stripWorkspacePluginToDefinitionPayload(overlay);
    const plugin = await resolveWorkspacePluginForTenant({
      workspaceType: "starter",
      tenantId: "tenant-b",
      metadataBinding: { definitionId: "starter-shell", definitionVersion: 1 },
      loadPublishedVersion: async () => ({
        id: "00000000-0000-4000-8000-000000000020",
        definitionId: "starter-shell",
        version: 1,
        pluginApiVersion: 1,
        payload,
        checksum: "abc",
        publishedAt: new Date("2026-06-21T12:00:00.000Z"),
      }),
    });
    assert.equal(plugin.fieldRegistry, payload.fieldRegistry);
  });

  it("CO-03 allowlist excluding tenant returns package path", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    env.WORKSPACE_METADATA_TENANT_ALLOWLIST = "allowed-tenant";
    const plugin = await resolveWorkspacePluginForTenant({
      workspaceType: "starter",
      tenantId: "blocked-tenant",
      metadataBinding: { definitionId: "starter-shell", definitionVersion: 1 },
      loadPublishedVersion: async () => {
        throw new Error("should not load metadata for blocked tenant");
      },
    });
    assert.equal(plugin.id, resolveWorkspacePluginForType("starter").id);
    assert.equal(isWorkspaceMetadataEnabledForTenant("blocked-tenant"), false);
  });

  it("CO-04 rollback binding shape is null", () => {
    assert.equal(
      toTenantWorkspaceMetadataBinding({
        workspaceDefinitionId: null,
        workspaceDefinitionVersion: null,
      }),
      null
    );
  });

  it("CO-05 missing definition row throws WORKSPACE_DEFINITION_NOT_FOUND", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;
    await assert.rejects(
      () =>
        resolveWorkspacePluginForTenant({
          workspaceType: "starter",
          tenantId: "tenant-c",
          metadataBinding: { definitionId: "missing-definition" },
          loadPublishedVersion: async () => null,
        }),
      /WORKSPACE_DEFINITION_NOT_FOUND:missing-definition/
    );
  });

  it("documents rollback steps in runbook comment", () => {
    assert.equal(isWorkspaceMetadataEnabled(), false);
  });
});

/*
Rollback runbook (staging pilot):
1. Super Admin → clear workspace definition binding (PATCH null)
2. Or remove tenant from WORKSPACE_METADATA_TENANT_ALLOWLIST
3. Or set WORKSPACE_METADATA_ENABLED=false on API pods
*/
