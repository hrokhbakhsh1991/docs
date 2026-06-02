import assert from "node:assert/strict";
import test from "node:test";

import { assertWorkspaceRequest } from "./assert-workspace-request";

test("assertWorkspaceRequest skips network lookup when middleware injected x-tenant-slug", async () => {
  const headers = new Headers({
    host: "ws1-rbac.localhost:3000",
    "x-tenant-slug": "ws1-rbac",
  });

  const result = await assertWorkspaceRequest(headers);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.tenant.tenantSlug, "ws1-rbac");
  }
});
