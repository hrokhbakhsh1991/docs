import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clearWorkspaceIntakePluginRegistryForTests,
  listWorkspaceIntakePluginIds,
} from "@app-tour/workspace-sdk";

import {
  registerWorkspaceIntakeSafe,
  registerWorkspacePluginSafe,
  resetWorkspacePluginBootstrapStateForTests,
} from "../src/register-safe";

describe("registerWorkspacePluginSafe", () => {
  it("HOST-REG-01 intake-safe path registers urban catalog intake", async () => {
    resetWorkspacePluginBootstrapStateForTests();
    clearWorkspaceIntakePluginRegistryForTests();

    const result = await registerWorkspaceIntakeSafe("urban");
    assert.equal(result.status, "ready");
    assert.equal(result.pluginId, "urban");
    assert.deepEqual(listWorkspaceIntakePluginIds(), ["urban"]);
  });

  it("HOST-REG-02 unknown plugin id fails closed without throwing", async () => {
    resetWorkspacePluginBootstrapStateForTests();

    const result = await registerWorkspacePluginSafe("unknown-workspace");
    assert.equal(result.status, "failed");
    assert.match(result.error, /WORKSPACE_PLUGIN_REGISTER_UNKNOWN/);
  });
});
