/**
 * Phase 9.1 — OperatorSurface CASL (DEC-P9-004)
 * Authority: docs/phase-9/appendices/CASL-OPERATOR-SPEC.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTenantAuthz } from "../src/auth/tenant-authz";

const DENALI_TENANT = "00000000-0000-4000-8000-000000000001";
const DENALI_WORKSPACE = "00000000-0000-4000-8000-000000000101";
const URBAN_TENANT = "00000000-0000-4000-8000-000000000002";

const URBAN_OWNER_MUTATION_POLICY = {
  requiredWorkspaceType: "urban",
  allowedSurfaces: new Set([
    "urban.settings.read",
    "urban.settings.update",
    "urban.catalog.admin.read",
    "urban.catalog.admin.update",
    "urban.catalog.admin.delete",
    "urban.catalog.publish",
    "urban.catalog.unpublish",
    "urban.tour.publish_fields",
  ]),
} as const;

function authzFor(role: "owner" | "admin" | "member", tenantId = DENALI_TENANT) {
  return buildTenantAuthz({
    userId: `u-${role}`,
    tenantId,
    role,
    status: "ACTIVE",
    workspaceId: DENALI_WORKSPACE,
  });
}

describe("operator-ability.spec.ts — Phase 9.1", () => {
  it("SDK-9.1-01 denali admin canPerformOperatorSurface settings.mutate", () => {
    const authz = authzFor("admin");
    assert.equal(authz.canPerformOperatorSurface("operator.settings.mutate"), true);
  });

  it("SDK-9.1-02 denali member denied operator.settings.mutate", () => {
    const authz = authzFor("member");
    assert.equal(authz.canPerformOperatorSurface("operator.settings.mutate"), false);
  });

  it("SDK-9.4-01 denali owner allowed operator.users.read (DEC-P9-018)", () => {
    const authz = authzFor("owner");
    assert.equal(authz.canPerformOperatorSurface("operator.users.read"), true);
    assert.equal(authz.canPerformOperatorSurface("operator.users.mutate"), true);
  });

  it("SDK-9.4-02 denali admin denied operator.users.read (DEC-P9-018)", () => {
    const authz = authzFor("admin");
    assert.equal(authz.canPerformOperatorSurface("operator.users.read"), false);
    assert.equal(authz.canPerformOperatorSurface("operator.users.mutate"), false);
  });

  it("SDK-9.1-03 denali member allowed operator.tours.read", () => {
    const authz = authzFor("member");
    assert.equal(authz.canPerformOperatorSurface("operator.tours.read"), true);
  });

  it("SDK-9.1-04 urban admin denied urban.settings.update (owner only)", () => {
    const authz = buildTenantAuthz({
      userId: "u-urban-admin",
      tenantId: URBAN_TENANT,
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-urban",
    });
    assert.equal(
      authz.canPerformWorkspaceOwnerMutation(
        URBAN_TENANT,
        "urban.settings.update",
        "urban",
        URBAN_OWNER_MUTATION_POLICY
      ),
      false
    );
    assert.equal(authz.canPerformOperatorSurface("urban.settings.update"), false);
  });

  it("SDK-9.1-05 urban owner allowed urban.settings.update", () => {
    const authz = buildTenantAuthz({
      userId: "u-urban-owner",
      tenantId: URBAN_TENANT,
      role: "owner",
      status: "ACTIVE",
      workspaceId: "ws-urban",
    });
    assert.equal(
      authz.canPerformWorkspaceOwnerMutation(
        URBAN_TENANT,
        "urban.settings.update",
        "urban",
        URBAN_OWNER_MUTATION_POLICY
      ),
      true
    );
  });

  it("SDK-9.6-01 denali admin operator.settings.equipment.mutate", () => {
    const authz = authzFor("admin");
    assert.equal(authz.canPerformOperatorSurface("operator.settings.equipment.mutate"), true);
  });

  it("SDK-9.6-02 denali member denied operator.settings.equipment.mutate", () => {
    const authz = authzFor("member");
    assert.equal(authz.canPerformOperatorSurface("operator.settings.equipment.mutate"), false);
  });

  it("SDK-9.6-03 denali member allowed operator.settings.audit_trail.read", () => {
    const authz = authzFor("member");
    assert.equal(authz.canPerformOperatorSurface("operator.settings.audit_trail.read"), true);
  });

  it("SDK-9.6-04 denali member allowed operator.settings.workspace_branding.read", () => {
    const authz = authzFor("member");
    assert.equal(authz.canPerformOperatorSurface("operator.settings.workspace_branding.read"), true);
  });
});
