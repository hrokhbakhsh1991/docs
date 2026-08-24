import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";
import {
  getWorkspacePlugin,
  getCertEventsWorkspacePlugin,
  CERT_EVENTS_WORKSPACE_PLUGIN_ID,
} from "../src/cert-events.plugin";

describe("cert-events workspace scaffold", () => {
  it("exports a valid WorkspacePlugin via canonical getWorkspacePlugin", () => {
    const plugin = getWorkspacePlugin();
    assert.equal(isWorkspacePlugin(plugin), true);
    assert.equal(plugin.id, CERT_EVENTS_WORKSPACE_PLUGIN_ID);
    assert.equal(getCertEventsWorkspacePlugin().id, plugin.id);
  });
});
