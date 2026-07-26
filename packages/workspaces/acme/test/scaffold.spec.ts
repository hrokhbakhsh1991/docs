import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";
import {
  getWorkspacePlugin,
  getAcmeWorkspacePlugin,
  ACME_WORKSPACE_PLUGIN_ID,
} from "../src/acme.plugin";

describe("acme workspace scaffold", () => {
  it("exports a valid WorkspacePlugin via canonical getWorkspacePlugin", () => {
    const plugin = getWorkspacePlugin();
    assert.equal(isWorkspacePlugin(plugin), true);
    assert.equal(plugin.id, ACME_WORKSPACE_PLUGIN_ID);
    assert.equal(getAcmeWorkspacePlugin().id, plugin.id);
  });

  it("publishes capabilities.hostProbe for Thin Shell Next boot stub (Phase 4s)", () => {
    const plugin = getWorkspacePlugin();
    assert.equal(plugin.capabilities?.hostProbe?.title, "Acme workspace");
    assert.match(plugin.capabilities?.hostProbe?.body ?? "", /host-probe/);
  });
});
