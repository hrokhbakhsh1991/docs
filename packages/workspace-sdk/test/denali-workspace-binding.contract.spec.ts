import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveWorkspacePluginIdForType,
} from "../src/plugin/workspace-type-binding.js";

describe("denali workspace binding contract (FTV-SPEC-12, REQ-P6-026)", () => {
  it('resolveWorkspacePluginIdForType("denali") returns "denali"', () => {
    assert.equal(
      resolveWorkspacePluginIdForType("denali", DEFAULT_WORKSPACE_TYPE_BINDINGS),
      "denali"
    );
  });
});
