/**
 * P5-B-N-009 — operator web plugin resolve (WEB-01..02)
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import { stripWorkspacePluginToDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

import { resolveOperatorWorkspacePlugin } from "../src/wizard/resolve-operator-workspace-plugin";
import { loadOperatorWorkspacePlugin } from "../src/wizard/load-workspace-plugin";

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

describe("operator-metadata-plugin-resolve (P5-B-N-009)", () => {
  it("WEB-01 binding + flag → metadata loader adapts overlay", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;

    const overlay = getStarterWorkspacePlugin();
    const payload = stripWorkspacePluginToDefinitionPayload(overlay);
    payload.fieldRegistry = {
      version: payload.fieldRegistry.version,
      fields: [
        ...payload.fieldRegistry.fields,
        {
          id: "basics.metadataMarker",
          canonicalPath: "basics.metadataMarker",
          kind: "text",
          required: false,
          stepId: "basics",
        },
      ],
    };

    let metadataLoaderCalls = 0;
    const plugin = await resolveOperatorWorkspacePlugin({
      pluginId: overlay.id,
      tenantId: "pilot-tenant",
      metadataBinding: { definitionId: "starter-shell", definitionVersion: 1 },
      loadPackagePlugin: async () => overlay,
      loadMetadataPayload: async () => {
        metadataLoaderCalls += 1;
        return payload;
      },
    });

    assert.equal(metadataLoaderCalls, 1);
    assert.equal(plugin.fieldRegistry, payload.fieldRegistry);
    assert.equal(plugin.validation, overlay.validation);
    assert.equal(plugin.lifecycle, overlay.lifecycle);
  });

  it("WEB-02 no binding → package plugin without metadata loader", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;

    const overlay = getStarterWorkspacePlugin();
    let metadataLoaderCalls = 0;

    const plugin = await resolveOperatorWorkspacePlugin({
      pluginId: overlay.id,
      tenantId: "pilot-tenant",
      metadataBinding: null,
      loadPackagePlugin: async () => overlay,
      loadMetadataPayload: async () => {
        metadataLoaderCalls += 1;
        throw new Error("should not load metadata without binding");
      },
    });

    assert.equal(metadataLoaderCalls, 0);
    assert.equal(plugin.id, overlay.id);
    assert.equal(plugin.fieldRegistry, overlay.fieldRegistry);
  });

  it("WEB-02b flag off with binding still returns package plugin", async () => {
    delete env.WORKSPACE_METADATA_ENABLED;

    const overlay = getStarterWorkspacePlugin();
    let metadataLoaderCalls = 0;

    const plugin = await resolveOperatorWorkspacePlugin({
      pluginId: overlay.id,
      tenantId: "pilot-tenant",
      metadataBinding: { definitionId: "starter-shell", definitionVersion: 1 },
      loadPackagePlugin: async () => overlay,
      loadMetadataPayload: async () => {
        metadataLoaderCalls += 1;
        throw new Error("should not load metadata when flag off");
      },
    });

    assert.equal(metadataLoaderCalls, 0);
    assert.equal(plugin.fieldRegistry, overlay.fieldRegistry);
  });

  it("allowlist excluding tenant returns package plugin", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    env.WORKSPACE_METADATA_TENANT_ALLOWLIST = "allowed-tenant";

    const overlay = getStarterWorkspacePlugin();
    const plugin = await resolveOperatorWorkspacePlugin({
      pluginId: overlay.id,
      tenantId: "blocked-tenant",
      metadataBinding: { definitionId: "starter-shell", definitionVersion: 1 },
      loadPackagePlugin: async () => overlay,
      loadMetadataPayload: async () => {
        throw new Error("should not load metadata for blocked tenant");
      },
    });

    assert.equal(plugin.id, overlay.id);
    assert.equal(plugin.fieldRegistry, overlay.fieldRegistry);
  });

  it("WEB-03 loadOperatorWorkspacePlugin facade delegates to resolver", async () => {
    const overlay = getStarterWorkspacePlugin();
    const plugin = await loadOperatorWorkspacePlugin({
      pluginId: overlay.id,
      tenantId: "pilot-tenant",
      metadataBinding: null,
    });
    assert.equal(plugin.id, overlay.id);
  });

  it("missing definition row throws WORKSPACE_DEFINITION_NOT_FOUND", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;

    const overlay = getStarterWorkspacePlugin();
    await assert.rejects(
      () =>
        resolveOperatorWorkspacePlugin({
          pluginId: overlay.id,
          tenantId: "pilot-tenant",
          metadataBinding: { definitionId: "missing-definition" },
          loadPackagePlugin: async () => overlay,
          loadMetadataPayload: async () => null,
        }),
      /WORKSPACE_DEFINITION_NOT_FOUND:missing-definition/
    );
  });
});
