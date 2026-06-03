import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveWorkspacePluginIdForType,
} from "../src/plugin/workspace-type-binding.js";

describe("denali workspace binding contract (FTV-SPEC-12)", () => {
  it('resolveWorkspacePluginIdForType("denali") returns null until Phase 6', () => {
    assert.equal(
      resolveWorkspacePluginIdForType("denali", DEFAULT_WORKSPACE_TYPE_BINDINGS),
      null,
    );
  });
});
