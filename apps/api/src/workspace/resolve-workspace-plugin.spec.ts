import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import { getUrbanWorkspacePlugin } from "@app-tour/workspace-urban";

import { resolveWorkspacePluginForType } from "./resolve-workspace-plugin";

describe("resolveWorkspacePluginForType (5.2 / 6.5)", () => {
  it("resolves starter workspace_type to starter plugin", async () => {
    const plugin = await resolveWorkspacePluginForType("starter");
    assert.equal(plugin.id, getStarterWorkspacePlugin().id);
  });

  it("resolves denali workspace_type to denali plugin (REQ-P6-013)", async () => {
    const plugin = await resolveWorkspacePluginForType("denali");
    assert.equal(plugin.id, getDenaliWorkspacePlugin().id);
    assert.notEqual(plugin.id, getStarterWorkspacePlugin().id);
  });

  it("resolves urban workspace_type to urban plugin (REQ-P7-009)", async () => {
    const plugin = await resolveWorkspacePluginForType("urban");
    assert.equal(plugin.id, getUrbanWorkspacePlugin().id);
    assert.notEqual(plugin.id, getStarterWorkspacePlugin().id);
  });
});
