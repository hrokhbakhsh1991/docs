/**
 * Thin Shell Phase 4q — trunk acme plugin load smoke (registry → instance).
 * Complements admission specs; Next capability-route boot remains a later slice.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadBootstrapWorkspacePlugin } from "../src/bootstrap/resolve-bootstrap-workspace-plugin";
import { WorkspacePluginNotFoundError } from "../src/bootstrap/workspace-plugin-context-errors";

describe("thin-shell-trunk-acme-load — Phase 4q", () => {
  it("loadBootstrapWorkspacePlugin(acme) returns trunk acme plugin", async () => {
    const plugin = await loadBootstrapWorkspacePlugin("acme");
    assert.equal(plugin.id, "acme");
    assert.ok(Array.isArray(plugin.supportedWorkspaceTypes));
    assert.ok(plugin.supportedWorkspaceTypes.includes("acme"));
  });

  it("unknown pluginId fails closed (no product default)", async () => {
    await assert.rejects(
      () => loadBootstrapWorkspacePlugin("no-such-workspace-plugin"),
      WorkspacePluginNotFoundError
    );
  });
});
