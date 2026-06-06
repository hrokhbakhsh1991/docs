import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";

import { resolveWorkspacePluginForType } from "./resolve-workspace-plugin";

describe("resolveWorkspacePluginForType (5.2)", () => {
  it("resolves starter workspace_type to starter plugin", () => {
    const plugin = resolveWorkspacePluginForType("starter");
    assert.equal(plugin.id, getStarterWorkspacePlugin().id);
  });

  it("rejects unbound workspace_type (denali until Phase 6)", () => {
    assert.throws(() => resolveWorkspacePluginForType("denali"), /WORKSPACE_PLUGIN_NOT_BOUND:denali/);
  });
});
