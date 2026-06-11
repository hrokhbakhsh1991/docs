import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_CATALOG_GUEST_USER_ID,
  resolveUrbanPublicAuthFromHeaders,
} from "../src/http/resolve-urban-public-auth";

describe("resolve-urban-public-auth.spec.ts", () => {
  it("URB-AUTH-01 resolves guest actor from tenant header only", () => {
    const auth = resolveUrbanPublicAuthFromHeaders({
      tenantId: "00000000-0000-4000-8000-000000000004",
    });
    assert.equal(auth.tenantId, "00000000-0000-4000-8000-000000000004");
    assert.equal(auth.userId, PUBLIC_CATALOG_GUEST_USER_ID);
    assert.equal(auth.role, "none");
  });

  it("URB-AUTH-02 forwards member session headers", () => {
    const auth = resolveUrbanPublicAuthFromHeaders({
      tenantId: "00000000-0000-4000-8000-000000000004",
      userId: "00000000-0000-4000-8000-000000000402",
      role: "member",
      workspaceId: "ws-urban",
    });
    assert.equal(auth.role, "member");
    assert.equal(auth.userId, "00000000-0000-4000-8000-000000000402");
    assert.equal(auth.workspaceId, "ws-urban");
  });
});
