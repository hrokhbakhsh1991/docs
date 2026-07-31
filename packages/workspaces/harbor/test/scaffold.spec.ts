import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";
import {
  getWorkspacePlugin,
  getHarborWorkspacePlugin,
  HARBOR_WORKSPACE_PLUGIN_ID,
} from "../src/harbor.plugin";

describe("harbor workspace scaffold", () => {
  it("exports a valid WorkspacePlugin via canonical getWorkspacePlugin", () => {
    const plugin = getWorkspacePlugin();
    assert.equal(isWorkspacePlugin(plugin), true);
    assert.equal(plugin.id, HARBOR_WORKSPACE_PLUGIN_ID);
    assert.equal(getHarborWorkspacePlugin().id, plugin.id);
  });
});
