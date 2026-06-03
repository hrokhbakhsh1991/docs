import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTenantAuthz,
  canAccessWorkspaceTheme,
  canAccessWorkspaceThemeScoped,
} from "../../src/auth/tenant-authz.js";
import type { TenantAuthContext } from "../../src/auth/auth-context.js";
import { createTenantAuthz } from "../../src/auth/tenant-ability.js";
import { InvalidTenantAuthContextError } from "../../src/auth/validate-auth-context.js";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function activeMember(tenantId: string, workspaceId = "ws-1"): TenantAuthContext {
  return {
    userId: "user-1",
    tenantId,
    role: "member",
    status: "ACTIVE",
    workspaceId,
  };
}

function activeAdmin(tenantId: string): TenantAuthContext {
  return {
    userId: "admin-1",
    tenantId,
    role: "admin",
    status: "ACTIVE",
  };
}

function activeOwner(tenantId: string): TenantAuthContext {
  return {
    userId: "owner-1",
    tenantId,
    role: "owner",
    status: "ACTIVE",
  };
}

describe("buildTenantAuthz", () => {
  it("allows member to access WorkspaceTheme in same tenant (T1)", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A));
    assert.equal(
      canAccessWorkspaceTheme({
        authz,
        access: {
          tenantId: TENANT_A,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        pluginId: "starter",
      }),
      true,
    );
  });

  it("denies member WorkspaceTheme access for another tenant (T2)", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A));
    assert.equal(
      canAccessWorkspaceTheme({
        authz,
        access: {
          tenantId: TENANT_B,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        pluginId: "starter",
      }),
      false,
    );
  });

  it("denies member without workspaceId binding (fail-closed)", () => {
    const authz = buildTenantAuthz({
      userId: "user-1",
      tenantId: TENANT_A,
      role: "member",
      status: "ACTIVE",
    });
    assert.equal(
      canAccessWorkspaceTheme({
        authz,
        access: { tenantId: TENANT_A, workspaceId: "ws-1", pluginId: "starter" },
        pluginId: "starter",
      }),
      false,
    );
  });

  it("denies member access to another workspace in the same tenant", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A, "ws-1"));
    assert.equal(
      canAccessWorkspaceTheme({
        authz,
        access: { tenantId: TENANT_A, workspaceId: "ws-2", pluginId: "starter" },
        pluginId: "starter",
      }),
      false,
    );
  });

  it("denies when workspaceThemeAccess pluginId does not match gate pluginId", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A));
    assert.equal(
      canAccessWorkspaceTheme({
        authz,
        access: { tenantId: TENANT_A, workspaceId: "ws-1", pluginId: "other-plugin" },
        pluginId: "starter",
      }),
      false,
    );
  });

  it("denies when boundTenantId disagrees with access.tenantId", () => {
    const scoped = createTenantAuthz(activeMember(TENANT_A));
    assert.equal(
      canAccessWorkspaceTheme({
        authz: scoped.authz,
        access: { tenantId: TENANT_B, workspaceId: "ws-1", pluginId: "starter" },
        pluginId: "starter",
        boundTenantId: scoped.context.tenantId,
      }),
      false,
    );
  });

  it("canAccessWorkspaceThemeScoped enforces tenant binding", () => {
    const scoped = createTenantAuthz(activeMember(TENANT_A));
    assert.equal(
      canAccessWorkspaceThemeScoped(
        scoped,
        {
          tenantId: TENANT_A,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        "starter",
      ),
      true,
    );
    assert.equal(
      canAccessWorkspaceThemeScoped(
        scoped,
        {
          tenantId: TENANT_B,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        "starter",
      ),
      false,
    );
  });

  it("rejects invalid auth context before building authz", () => {
    assert.throws(
      () =>
        buildTenantAuthz({
          userId: "",
          tenantId: TENANT_A,
          role: "member",
          status: "ACTIVE",
          workspaceId: "ws-1",
        }),
      InvalidTenantAuthContextError,
    );
  });

  it("allows admin to manage own tenant (T3)", () => {
    const authz = buildTenantAuthz(activeAdmin(TENANT_A));
    assert.equal(authz.canManageTenant(TENANT_A), true);
  });

  it("denies member manage on another tenant (T4)", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A));
    assert.equal(authz.canManageTenant(TENANT_B), false);
  });

  it("allows member to read Plugin in same tenant (T5)", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A));
    assert.equal(
      authz.canReadPlugin({ tenantId: TENANT_A, pluginId: "starter" }),
      true,
    );
  });

  it("denies member Plugin read for another tenant (T5b)", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A));
    assert.equal(
      authz.canReadPlugin({ tenantId: TENANT_B, pluginId: "starter" }),
      false,
    );
  });

  it("allows member Workspace read and update in same tenant (T5c)", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A));
    assert.equal(authz.canReadWorkspace(TENANT_A, "ws-1"), true);
    assert.equal(authz.canUpdateWorkspace(TENANT_A, "ws-1"), true);
  });

  it("denies member Workspace read and update for another tenant (T5d)", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A));
    assert.equal(authz.canReadWorkspace(TENANT_B, "ws-1"), false);
    assert.equal(authz.canUpdateWorkspace(TENANT_B, "ws-1"), false);
  });

  it("denies member Workspace read for a different workspace in the same tenant", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A, "ws-1"));
    assert.equal(authz.canReadWorkspace(TENANT_A, "ws-2"), false);
  });

  it("allows owner to manage own tenant (T3b)", () => {
    const authz = buildTenantAuthz(activeOwner(TENANT_A));
    assert.equal(authz.canManageTenant(TENANT_A), true);
  });

  it("allows owner to install Plugin in same tenant (T3c)", () => {
    const authz = buildTenantAuthz(activeOwner(TENANT_A));
    assert.equal(
      authz.canInstallPlugin({ tenantId: TENANT_A, pluginId: "starter" }),
      true,
    );
  });

  it("allows canonical document read and update in same tenant (T6)", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A));
    const doc = { tenantId: TENANT_A, documentId: "doc-1" };
    assert.equal(authz.canReadCanonicalDocument(doc), true);
    assert.equal(authz.canUpdateCanonicalDocument(doc), true);
  });

  it("denies canonical document update in another tenant (T7)", () => {
    const authz = buildTenantAuthz(activeMember(TENANT_A));
    const doc = { tenantId: TENANT_B, documentId: "doc-1" };
    assert.equal(authz.canUpdateCanonicalDocument(doc), false);
  });

  it("denies WorkspaceTheme access when membership is SUSPENDED (T8)", () => {
    const authz = buildTenantAuthz({
      userId: "user-1",
      tenantId: TENANT_A,
      role: "member",
      status: "SUSPENDED",
      workspaceId: "ws-1",
    });
    assert.equal(
      canAccessWorkspaceTheme({
        authz,
        access: {
          tenantId: TENANT_A,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        pluginId: "starter",
      }),
      false,
    );
  });

  it("denies WorkspaceTheme access when role is none (T8b)", () => {
    const authz = buildTenantAuthz({
      userId: "user-1",
      tenantId: TENANT_A,
      role: "none",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });
    assert.equal(
      canAccessWorkspaceTheme({
        authz,
        access: {
          tenantId: TENANT_A,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        pluginId: "starter",
      }),
      false,
    );
  });

  it("returns distinct authz per context without shared mutation (T9)", () => {
    const authzA = buildTenantAuthz(activeMember(TENANT_A));
    const authzB = buildTenantAuthz(activeMember(TENANT_B));
    assert.equal(
      canAccessWorkspaceTheme({
        authz: authzA,
        access: {
          tenantId: TENANT_A,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        pluginId: "starter",
      }),
      true,
    );
    assert.equal(
      canAccessWorkspaceTheme({
        authz: authzA,
        access: {
          tenantId: TENANT_B,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        pluginId: "starter",
      }),
      false,
    );
    assert.equal(
      canAccessWorkspaceTheme({
        authz: authzB,
        access: {
          tenantId: TENANT_B,
          workspaceId: "ws-1",
          pluginId: "starter",
        },
        pluginId: "starter",
      }),
      true,
    );
  });
});
