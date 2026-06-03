import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertTenantAuthContext, InvalidTenantAuthContextError } from "../../src/auth/validate-auth-context.js";

describe("assertTenantAuthContext", () => {
  it("rejects empty tenantId", () => {
    assert.throws(
      () =>
        assertTenantAuthContext({
          userId: "u1",
          tenantId: "  ",
          role: "member",
          status: "ACTIVE",
          workspaceId: "ws-1",
        }),
      InvalidTenantAuthContextError,
    );
  });

  it("rejects path-like tenantId", () => {
    assert.throws(
      () =>
        assertTenantAuthContext({
          userId: "u1",
          tenantId: "../other",
          role: "member",
          status: "ACTIVE",
          workspaceId: "ws-1",
        }),
      InvalidTenantAuthContextError,
    );
  });

  it("rejects invalid role at runtime", () => {
    assert.throws(
      () =>
        assertTenantAuthContext({
          userId: "u1",
          tenantId: "t1",
          role: "superadmin" as "member",
          status: "ACTIVE",
        }),
      InvalidTenantAuthContextError,
    );
  });
});
