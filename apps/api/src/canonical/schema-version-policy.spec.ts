import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorkspaceCurrentSchemaVersion } from "./schema-version-policy";

test("resolves Denali version from the generated canonical binding", () => {
  assert.equal(resolveWorkspaceCurrentSchemaVersion("denali"), 1);
});

test("keeps registered workspaces without a declaration on the neutral contract", () => {
  assert.equal(resolveWorkspaceCurrentSchemaVersion("starter"), 1);
  assert.equal(resolveWorkspaceCurrentSchemaVersion("urban"), 1);
});

test("fails closed for an unknown workspace", () => {
  assert.throws(
    () => resolveWorkspaceCurrentSchemaVersion("zz-unknown-workspace"),
    /WORKSPACE_SCHEMA_VERSION_UNAVAILABLE:zz-unknown-workspace/
  );
});
