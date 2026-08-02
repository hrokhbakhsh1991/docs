import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WorkspacePluginNotFoundError } from "../src/bootstrap/workspace-plugin-context-errors";
import { resolveBootstrapWorkspacePluginClient } from "../src/bootstrap/resolve-bootstrap-workspace-plugin.client";
import {
  listAdminThemeRegistryPluginIds,
  resolveAdminThemeStylesheets,
} from "../src/bootstrap/workspace-theme-stylesheets.generated";

describe("resolveBootstrapWorkspacePluginClient (Wave B.b.2)", () => {
  it("returns starter plugin for starter; unknown ids fail closed", () => {
    const starter = resolveBootstrapWorkspacePluginClient("starter");
    assert.equal(starter.id, "starter");
    assert.throws(
      () => resolveBootstrapWorkspacePluginClient("no-such-plugin"),
      (err: unknown) => err instanceof WorkspacePluginNotFoundError
    );
  });

  it("builds theme shells from admin theme registry helpers without hand Map", () => {
    for (const pluginId of listAdminThemeRegistryPluginIds()) {
      if (pluginId === "starter") continue;
      const plugin = resolveBootstrapWorkspacePluginClient(pluginId);
      assert.equal(plugin.id, pluginId);
      assert.deepEqual(plugin.supportedWorkspaceTypes, [pluginId]);
      assert.equal(plugin.theme?.optionalStylesheet, resolveAdminThemeStylesheets(pluginId)?.[0]);
    }
  });

  it("denali shell uses denali-admin.css from registry", () => {
    const denali = resolveBootstrapWorkspacePluginClient("denali");
    assert.equal(denali.id, "denali");
    assert.equal(denali.theme?.optionalStylesheet, "theme/denali-admin.css");
  });
});
