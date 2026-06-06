import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";

import { resolveWorkspacePluginForType } from "./resolve-workspace-plugin";

describe("resolveWorkspacePluginForType (5.2 / 6.5)", () => {
  it("resolves starter workspace_type to starter plugin", () => {
    const plugin = resolveWorkspacePluginForType("starter");
    assert.equal(plugin.id, getStarterWorkspacePlugin().id);
  });

  it("resolves denali workspace_type to denali plugin (REQ-P6-013)", () => {
    const plugin = resolveWorkspacePluginForType("denali");
    assert.equal(plugin.id, getDenaliWorkspacePlugin().id);
    assert.notEqual(plugin.id, getStarterWorkspacePlugin().id);
  });
});
