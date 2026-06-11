import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTenantAuthContext } from "../../src/auth/auth-schemas.js";
import { InvalidTenantAuthContextError } from "../../src/auth/auth-context-errors.js";

describe("parseAuthRecord (CT-06)", () => {
  it("parses valid tenant context", () => {
    const ctx = parseTenantAuthContext({
      userId: "u1",
      tenantId: "tenant-a",
      role: "member",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });
    assert.equal(ctx.tenantId, "tenant-a");
    assert.equal(ctx.workspaceId, "ws-1");
  });

  it("parses viewer role (DEC-P9-019)", () => {
    const ctx = parseTenantAuthContext({
      userId: "u1",
      tenantId: "tenant-a",
      role: "viewer",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });
    assert.equal(ctx.role, "viewer");
  });

  it("rejects invalid role with typed code", () => {
    assert.throws(
      () =>
        parseTenantAuthContext({
          userId: "u1",
          tenantId: "tenant-a",
          role: "superuser",
          status: "ACTIVE",
        }),
      InvalidTenantAuthContextError,
    );
  });
});
