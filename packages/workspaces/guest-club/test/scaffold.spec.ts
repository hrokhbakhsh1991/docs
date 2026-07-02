import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";
import { getGuestClubWorkspacePlugin, GUEST_CLUB_WORKSPACE_PLUGIN_ID } from "../src/guest-club.plugin";

describe("guest-club workspace scaffold", () => {
  it("exports a valid WorkspacePlugin", () => {
    const plugin = getGuestClubWorkspacePlugin();
    assert.equal(isWorkspacePlugin(plugin), true);
    assert.equal(plugin.id, GUEST_CLUB_WORKSPACE_PLUGIN_ID);
  });
});
