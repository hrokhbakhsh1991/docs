import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import {
  stripWorkspacePluginToDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";

import { adaptMetadataPayloadToWorkspacePlugin } from "../src/workspace-metadata/metadata-plugin-adapter.ts";
import { isWorkspaceMetadataEnabled } from "../src/workspace-metadata/is-workspace-metadata-enabled.ts";
import { resolveWorkspacePluginForTenant } from "../src/workspace-metadata/load-workspace-plugin-for-tenant.ts";
import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin.ts";

const env = process.env as Record<string, string | undefined>;
const envSnapshot = { WORKSPACE_METADATA_ENABLED: env.WORKSPACE_METADATA_ENABLED };

afterEach(() => {
  if (envSnapshot.WORKSPACE_METADATA_ENABLED !== undefined) {
    env.WORKSPACE_METADATA_ENABLED = envSnapshot.WORKSPACE_METADATA_ENABLED;
  } else {
    delete env.WORKSPACE_METADATA_ENABLED;
  }
});

describe("isWorkspaceMetadataEnabled", () => {
  it("defaults false", async () => {
    delete env.WORKSPACE_METADATA_ENABLED;
    assert.equal(isWorkspaceMetadataEnabled(), false);
  });

  it("accepts true/1/yes", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    assert.equal(isWorkspaceMetadataEnabled(), true);
    env.WORKSPACE_METADATA_ENABLED = "1";
    assert.equal(isWorkspaceMetadataEnabled(), true);
  });
});

describe("adaptMetadataPayloadToWorkspacePlugin", () => {
  it("overlays data core onto package hooks", async () => {
    const overlay = getStarterWorkspacePlugin();
    const payload = stripWorkspacePluginToDefinitionPayload(overlay);
    const adapted = adaptMetadataPayloadToWorkspacePlugin(payload, overlay);
    assert.equal(adapted.fieldRegistry, payload.fieldRegistry);
    assert.equal(adapted.validation, overlay.validation);
    assert.equal(adapted.lifecycle, overlay.lifecycle);
  });
});

describe("resolveWorkspacePluginForTenant", () => {
  it("returns package plugin when flag off", async () => {
    delete env.WORKSPACE_METADATA_ENABLED;
    const plugin = await resolveWorkspacePluginForTenant({ workspaceType: "starter" });
    assert.equal(plugin.id, (await resolveWorkspacePluginForType("starter")).id);
  });

  it("returns package plugin when flag on but no binding", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    const plugin = await resolveWorkspacePluginForTenant({ workspaceType: "starter" });
    assert.equal(plugin.id, (await resolveWorkspacePluginForType("starter")).id);
  });

  it("loads metadata payload when flag and binding set", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    const overlay = getStarterWorkspacePlugin();
    const payload = stripWorkspacePluginToDefinitionPayload(overlay);
    const plugin = await resolveWorkspacePluginForTenant({
      workspaceType: "starter",
      metadataBinding: { definitionId: "starter-v1", definitionVersion: 1 },
      loadPublishedVersion: async () => ({
        id: "00000000-0000-4000-8000-000000000001",
        definitionId: "starter-v1",
        version: 1,
        pluginApiVersion: 1,
        payload,
        checksum: "abc",
        publishedAt: new Date("2026-06-21T12:00:00.000Z"),
      }),
    });
    assert.equal(plugin.fieldRegistry, payload.fieldRegistry);
    assert.equal(plugin.validation, overlay.validation);
  });

  it("throws when definition row missing", async () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    await assert.rejects(
      () =>
        resolveWorkspacePluginForTenant({
          workspaceType: "starter",
          metadataBinding: { definitionId: "missing" },
          loadPublishedVersion: async () => null,
        }),
      /WORKSPACE_DEFINITION_NOT_FOUND:missing/
    );
  });
});
