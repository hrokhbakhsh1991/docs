import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin as sdkReferencePlugin } from "@app-tour/workspace-sdk";

import { getStarterWorkspacePlugin } from "../src/starter.plugin";

/**
 * workspace-sdk keeps a reference export for packages that cannot import workspaces/* (depcruise).
 * workspace-starter re-exports the same plugin object; this test fails if that wiring diverges.
 */
describe("sdk reference parity", () => {
  it("re-exports the workspace-sdk reference plugin", () => {
    assert.strictEqual(getStarterWorkspacePlugin(), sdkReferencePlugin());
  });
});
