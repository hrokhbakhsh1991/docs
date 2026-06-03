import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  buildTenantAuthz,
  canAccessWorkspaceTheme,
  cannotAccessWorkspaceTheme,
} from "../../src/auth/tenant-authz.js";
import type { TenantAuthContext } from "../../src/auth/auth-context.js";
import type { TenantAuthz } from "../../src/auth/tenant-authz.js";
import { createFreshAuthz, harnessMemberContext } from "../lib/immutable-harness.js";

const ACTOR_TENANT = "tenant-a";
const FOREIGN_TENANT = "tenant-b";
const PREFIX_COLLISION_TENANT = "tenant-aa";

function memberOf(tenantId: string, workspaceId = "ws-1"): TenantAuthContext {
  return harnessMemberContext(tenantId, workspaceId);
}

describe("red-team data leakage", () => {
  let authz: TenantAuthz;

  beforeEach(() => {
    authz = createFreshAuthz(memberOf(ACTOR_TENANT));
  });

  it("denies Workspace read on a foreign tenant", () => {
    assert.equal(authz.canReadWorkspace(FOREIGN_TENANT, "ws-1"), false);
  });

  it("denies Workspace update on a foreign tenant", () => {
    assert.equal(authz.canUpdateWorkspace(FOREIGN_TENANT, "ws-1"), false);
  });

  it("denies Tenant read on a foreign tenant", () => {
    assert.equal(authz.canReadTenant(FOREIGN_TENANT), false);
  });

  it("denies Tenant manage on a foreign tenant", () => {
    assert.equal(authz.canManageTenant(FOREIGN_TENANT), false);
  });

  it("denies WorkspaceTheme access on a foreign tenant", () => {
    assert.equal(
      canAccessWorkspaceTheme({
        authz,
        access: {
          tenantId: FOREIGN_TENANT,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        pluginId: "starter",
      }),
      false,
    );
  });

  it("denies tenantId prefix collision (tenant-a actor vs tenant-aa subject)", () => {
    assert.equal(authz.canReadTenant(PREFIX_COLLISION_TENANT), false);
    assert.equal(
      canAccessWorkspaceTheme({
        authz,
        access: {
          tenantId: PREFIX_COLLISION_TENANT,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        pluginId: "starter",
      }),
      false,
    );
  });

  it("denies path-like tenantId injection at context parse", () => {
    assert.throws(() =>
      buildTenantAuthz({
        userId: "u1",
        tenantId: "../tenant-b",
        role: "member",
        status: "ACTIVE",
        workspaceId: "ws-1",
      }),
    );
  });
});

describe("red-team WorkspaceTheme default deny", () => {
  const themeAccess = {
    tenantId: ACTOR_TENANT,
    workspaceId: "ws-1",
    pluginId: "starter",
  };

  it("cannotAccessWorkspaceTheme is inverse of canAccessWorkspaceTheme", () => {
    const authz = createFreshAuthz(memberOf(ACTOR_TENANT));
    const params = { authz, access: themeAccess, pluginId: "starter" };
    assert.equal(canAccessWorkspaceTheme(params), !cannotAccessWorkspaceTheme(params));
  });
});
