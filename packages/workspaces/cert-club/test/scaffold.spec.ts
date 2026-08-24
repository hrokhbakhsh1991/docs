import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";
import {
  getWorkspacePlugin,
  getCertClubWorkspacePlugin,
  CERT_CLUB_WORKSPACE_PLUGIN_ID,
} from "../src/cert-club.plugin";

describe("cert-club workspace scaffold", () => {
  it("exports a valid WorkspacePlugin via canonical getWorkspacePlugin", () => {
    const plugin = getWorkspacePlugin();
    assert.equal(isWorkspacePlugin(plugin), true);
    assert.equal(plugin.id, CERT_CLUB_WORKSPACE_PLUGIN_ID);
    assert.equal(getCertClubWorkspacePlugin().id, plugin.id);
  });
});
