import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { URBAN_WORKSPACE_PLUGIN_ID } from "../src/plugin/workspace-plugin-id.js";
import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveWorkspacePluginIdForType,
} from "../src/plugin/workspace-type-binding.js";
import { URBAN_WORKSPACE_TYPE } from "../src/plugin/workspace-type-id.js";

describe("urban workspace binding contract (REQ-P7-009, REQ-P7-010)", () => {
  it('resolveWorkspacePluginIdForType("urban") returns "urban"', () => {
    assert.equal(
      resolveWorkspacePluginIdForType("urban", DEFAULT_WORKSPACE_TYPE_BINDINGS),
      URBAN_WORKSPACE_PLUGIN_ID
    );
  });

  it("DEFAULT_WORKSPACE_TYPE_BINDINGS includes urban type mapping", () => {
    const urban = DEFAULT_WORKSPACE_TYPE_BINDINGS.find(
      (binding) => binding.workspaceType === URBAN_WORKSPACE_TYPE
    );
    assert.ok(urban);
    assert.equal(urban.pluginId, URBAN_WORKSPACE_PLUGIN_ID);
  });
});
