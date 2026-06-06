import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_WORKSPACE_PLUGIN_ID, STARTER_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-sdk";

import { resolveWorkspacePlugin } from "../src/bootstrap/workspace-plugin-registry";
import { loadWorkspacePluginById } from "../src/wizard/load-workspace-plugin";

describe("dynamic workspace plugin loader", () => {
  it("resolves starter plugin by id from bootstrap registry", async () => {
    const plugin = await loadWorkspacePluginById(STARTER_WORKSPACE_PLUGIN_ID);
    assert.equal(plugin.id, STARTER_WORKSPACE_PLUGIN_ID);
    assert.ok(plugin.wizard.roots.includes("basics"));
  });

  it("lazy-loads denali plugin by id (REQ-P6-014)", async () => {
    const plugin = await loadWorkspacePluginById(DENALI_WORKSPACE_PLUGIN_ID);
    assert.equal(plugin.id, DENALI_WORKSPACE_PLUGIN_ID);
    assert.ok(plugin.wizard.roots.length > 0);
  });

  it("throws for unknown plugin id", () => {
    assert.throws(() => resolveWorkspacePlugin("unknown-plugin"), /WORKSPACE_PLUGIN_NOT_FOUND/);
  });
});
