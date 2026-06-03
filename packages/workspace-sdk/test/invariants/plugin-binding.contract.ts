import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "../../src/plugin/workspace-plugin.js";
import { STARTER_WORKSPACE_PLUGIN_ID } from "../../src/plugin/workspace-plugin-id.js";
import {
  isWorkspaceTypeId,
  STARTER_WORKSPACE_TYPE,
  workspaceTypesFromPlugin,
} from "../../src/plugin/workspace-type.js";
import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveWorkspacePluginIdForType,
} from "../../src/plugin/workspace-type-binding.js";
import { getWorkspaceRuleCell } from "../../src/registry/rule-set.js";
import { createFreshStarterPlugin } from "../lib/immutable-harness.js";

describe("invariant: plugin-binding", () => {
  it("fresh starter plugin satisfies structural guard", () => {
    const plugin = createFreshStarterPlugin();
    assert.equal(isWorkspacePlugin(plugin), true);
    assert.equal(plugin.id, STARTER_WORKSPACE_PLUGIN_ID);
    assert.equal(plugin.version, 1);
  });

  it("resolves workspace type bindings", () => {
    const plugin = createFreshStarterPlugin();
    const allowed = workspaceTypesFromPlugin(plugin);
    assert.equal(isWorkspaceTypeId(STARTER_WORKSPACE_TYPE, allowed), true);
    assert.equal(isWorkspaceTypeId("denali", allowed), false);
    assert.equal(
      resolveWorkspacePluginIdForType(STARTER_WORKSPACE_TYPE, DEFAULT_WORKSPACE_TYPE_BINDINGS),
      STARTER_WORKSPACE_PLUGIN_ID,
    );
    assert.equal(resolveWorkspacePluginIdForType("unknown", DEFAULT_WORKSPACE_TYPE_BINDINGS), null);
  });

  it("exposes default rule cell overrides", () => {
    const plugin = createFreshStarterPlugin();
    const cell = getWorkspaceRuleCell(plugin.ruleSet, "default");
    assert.ok(cell);
    assert.equal(cell.fieldOverrides.length, 2);
  });
});
