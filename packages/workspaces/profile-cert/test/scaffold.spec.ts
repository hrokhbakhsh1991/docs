import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";
import {
  getWorkspacePlugin,
  getProfileCertWorkspacePlugin,
  PROFILE_CERT_WORKSPACE_PLUGIN_ID,
} from "../src/profile-cert.plugin";

describe("profile-cert workspace scaffold", () => {
  it("exports a valid WorkspacePlugin via canonical getWorkspacePlugin", () => {
    const plugin = getWorkspacePlugin();
    assert.equal(isWorkspacePlugin(plugin), true);
    assert.equal(plugin.id, PROFILE_CERT_WORKSPACE_PLUGIN_ID);
    assert.equal(getProfileCertWorkspacePlugin().id, plugin.id);
  });
});
