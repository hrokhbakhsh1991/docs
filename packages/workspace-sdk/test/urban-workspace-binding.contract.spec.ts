import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveWorkspacePluginIdForType,
} from "../src/plugin/workspace-type-binding.js";

describe("urban workspace binding contract (REQ-P7-009, REQ-P7-010)", () => {
  it('resolveWorkspacePluginIdForType("urban") returns "urban"', () => {
    assert.equal(
      resolveWorkspacePluginIdForType("urban", DEFAULT_WORKSPACE_TYPE_BINDINGS),
      "urban"
    );
  });

  it("DEFAULT_WORKSPACE_TYPE_BINDINGS includes urban type mapping", () => {
    const urban = DEFAULT_WORKSPACE_TYPE_BINDINGS.find(
      (binding) => binding.workspaceType === "urban"
    );
    assert.ok(urban);
    assert.equal(urban.pluginId, "urban");
  });
});
