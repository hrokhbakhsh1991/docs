/**
 * Phase 8.1 — SDK owner ability contract (SDK-8.1-01..08)
 * Authority: docs/phase-8/subphases/8.1-single-owner-auth.md §5 · DEC-P8-004
 * Implementation target: packages/workspace-sdk/src/auth/tenant-authz.ts (method)
 * Grant: packages/workspace-sdk/src/auth/tenant-auth-grants.ts (isWorkspaceOwner)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTenantAuthz } from "../src/auth/tenant-authz.js";
import { isWorkspaceOwner } from "../src/auth/tenant-auth-grants.js";

const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const STARTER_TENANT_ID = "00000000-0000-4000-8000-000000000001";

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      assert.equal(actual, expected);
    },
  };
}

function activeAuth(role: "owner" | "admin" | "member", tenantId = URBAN_TENANT_ID) {
  return {
    userId: `user-${role}`,
    tenantId,
    role,
    status: "ACTIVE" as const,
    workspaceId: "00000000-0000-4000-8000-000000000403",
  };
}

describe("Phase 8.1 SDK urban owner ability", () => {
  it("SDK-8.1-01 owner can mutate urban.settings.update on urban workspace", () => {
    const authz = buildTenantAuthz(activeAuth("owner"));
    expect(
      authz.canPerformUrbanOwnerMutation(URBAN_TENANT_ID, "urban.settings.update", "urban")
    ).toBe(true);
  });

  it("SDK-8.1-02 admin cannot mutate urban.settings.update", () => {
    const authz = buildTenantAuthz(activeAuth("admin"));
    expect(
      authz.canPerformUrbanOwnerMutation(URBAN_TENANT_ID, "urban.settings.update", "urban")
    ).toBe(false);
  });

  it("SDK-8.1-03 member cannot mutate urban.settings.update", () => {
    const authz = buildTenantAuthz(activeAuth("member"));
    expect(
      authz.canPerformUrbanOwnerMutation(URBAN_TENANT_ID, "urban.settings.update", "urban")
    ).toBe(false);
  });

  it("SDK-8.1-04 owner can declare urban.catalog.publish capability", () => {
    const authz = buildTenantAuthz(activeAuth("owner"));
    expect(
      authz.canPerformUrbanOwnerMutation(URBAN_TENANT_ID, "urban.catalog.publish", "urban")
    ).toBe(true);
  });

  it("SDK-8.1-05 admin cannot declare urban.catalog.publish capability", () => {
    const authz = buildTenantAuthz(activeAuth("admin"));
    expect(
      authz.canPerformUrbanOwnerMutation(URBAN_TENANT_ID, "urban.catalog.publish", "urban")
    ).toBe(false);
  });

  it("SDK-8.1-06 owner on starter workspace cannot mutate urban.settings.update", () => {
    const authz = buildTenantAuthz(activeAuth("owner", STARTER_TENANT_ID));
    expect(
      authz.canPerformUrbanOwnerMutation(STARTER_TENANT_ID, "urban.settings.update", "starter")
    ).toBe(false);
  });

  it("SDK-8.1-07 isWorkspaceOwner returns true for owner role", () => {
    expect(isWorkspaceOwner(activeAuth("owner"))).toBe(true);
  });

  it("SDK-8.1-08 isWorkspaceOwner returns false for admin role", () => {
    expect(isWorkspaceOwner(activeAuth("admin"))).toBe(false);
  });
});
