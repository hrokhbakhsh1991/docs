import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTenantAuthz } from "../src/auth/tenant-authz.js";

describe("canPerformWorkspaceOwnerMutation (P5-T02)", () => {
  const policy = {
    requiredWorkspaceType: "demo",
    allowedSurfaces: new Set(["demo.settings.update"]),
  } as const;

  it("grants owner on matching workspace type and allowlisted surface", () => {
    const authz = buildTenantAuthz({
      userId: "u1",
      tenantId: "tenant-a",
      workspaceId: "ws-1",
      role: "owner",
      status: "ACTIVE",
    });
    assert.equal(
      authz.canPerformWorkspaceOwnerMutation(
        "tenant-a",
        "demo.settings.update",
        "demo",
        policy
      ),
      true
    );
  });

  it("denies admin on owner-only policy", () => {
    const authz = buildTenantAuthz({
      userId: "u1",
      tenantId: "tenant-a",
      workspaceId: "ws-1",
      role: "admin",
      status: "ACTIVE",
    });
    assert.equal(
      authz.canPerformWorkspaceOwnerMutation(
        "tenant-a",
        "demo.settings.update",
        "demo",
        policy
      ),
      false
    );
  });

  it("denies when workspace type does not match policy", () => {
    const authz = buildTenantAuthz({
      userId: "u1",
      tenantId: "tenant-a",
      workspaceId: "ws-1",
      role: "owner",
      status: "ACTIVE",
    });
    assert.equal(
      authz.canPerformWorkspaceOwnerMutation(
        "tenant-a",
        "demo.settings.update",
        "starter",
        policy
      ),
      false
    );
  });
});
