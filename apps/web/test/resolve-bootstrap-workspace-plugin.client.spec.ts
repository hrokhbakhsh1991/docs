import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBootstrapWorkspacePluginClient } from "../src/bootstrap/resolve-bootstrap-workspace-plugin.client";
import { WORKSPACE_ADMIN_THEME_REGISTRY } from "../src/bootstrap/workspace-theme-stylesheets.generated";

describe("resolveBootstrapWorkspacePluginClient (Wave B.b.2)", () => {
  it("returns starter plugin for starter and unknown ids", () => {
    const starter = resolveBootstrapWorkspacePluginClient("starter");
    assert.equal(starter.id, "starter");
    const unknown = resolveBootstrapWorkspacePluginClient("no-such-plugin");
    assert.equal(unknown.id, "starter");
  });

  it("builds theme shells from WORKSPACE_ADMIN_THEME_REGISTRY without hand Map", () => {
    for (const pluginId of Object.keys(WORKSPACE_ADMIN_THEME_REGISTRY)) {
      if (pluginId === "starter") continue;
      const plugin = resolveBootstrapWorkspacePluginClient(pluginId);
      assert.equal(plugin.id, pluginId);
      assert.deepEqual(plugin.supportedWorkspaceTypes, [pluginId]);
      assert.equal(
        plugin.theme?.optionalStylesheet,
        WORKSPACE_ADMIN_THEME_REGISTRY[pluginId]![0]
      );
    }
  });

  it("denali shell uses denali-admin.css from registry", () => {
    const denali = resolveBootstrapWorkspacePluginClient("denali");
    assert.equal(denali.id, "denali");
    assert.equal(denali.theme?.optionalStylesheet, "theme/denali-admin.css");
  });
});
