import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTenantAuthz,
  canAccessWorkspaceTheme,
} from "../../src/auth/tenant-authz.js";
import {
  HARNESS_TENANT_A,
  HARNESS_TENANT_B,
  harnessMemberContext,
} from "../lib/immutable-harness.js";

describe("invariant: auth-sealing", () => {
  it("denies cross-tenant workspace read", () => {
    const authz = buildTenantAuthz(harnessMemberContext(HARNESS_TENANT_A));
    assert.equal(authz.canReadWorkspace(HARNESS_TENANT_B, "ws-1"), false);
  });

  it("denies cross-tenant tenant read", () => {
    const authz = buildTenantAuthz(harnessMemberContext(HARNESS_TENANT_A));
    assert.equal(authz.canReadTenant(HARNESS_TENANT_B), false);
  });

  it("denies workspace theme access on foreign tenant", () => {
    const authz = buildTenantAuthz(harnessMemberContext(HARNESS_TENANT_A));
    assert.equal(
      canAccessWorkspaceTheme({
        authz,
        access: {
          tenantId: HARNESS_TENANT_B,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        pluginId: "starter",
      }),
      false,
    );
  });
});
