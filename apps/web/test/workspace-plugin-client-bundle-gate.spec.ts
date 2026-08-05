import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertWorkspacePluginClientBundleEnabled,
  WorkspacePluginClientBundleDisabledError,
} from "../src/bootstrap/workspace-plugin-client-bundle-gate";

describe("workspace plugin client bundle gate", () => {
  it("allows the generated loader to continue when its manifest gate is enabled", () => {
    assert.doesNotThrow(() =>
      assertWorkspacePluginClientBundleEnabled("denali", "ALLOW_DENALI_WEB_PLUGIN", true)
    );
  });

  it("fails before import when its manifest gate is disabled", () => {
    let importAttempted = false;
    assert.throws(
      () => {
        assertWorkspacePluginClientBundleEnabled("denali", "ALLOW_DENALI_WEB_PLUGIN", false);
        importAttempted = true;
      },
      (error: unknown) => {
        assert.ok(error instanceof WorkspacePluginClientBundleDisabledError);
        assert.equal(error.pluginId, "denali");
        assert.equal(error.envKey, "ALLOW_DENALI_WEB_PLUGIN");
        return true;
      }
    );
    assert.equal(importAttempted, false);
  });
});
