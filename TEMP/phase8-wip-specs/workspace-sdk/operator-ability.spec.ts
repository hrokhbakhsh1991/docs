/**
 * Phase 9.1 — OperatorSurface CASL scaffold
 * Authority: docs/phase-9/appendices/CASL-OPERATOR-SPEC.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTenantAuthz } from "../src/auth/tenant-authz";

const DENALI_TENANT = "00000000-0000-4000-8000-000000000001";
const DENALI_WORKSPACE = "00000000-0000-4000-8000-000000000101";

describe("operator-ability.spec.ts — Phase 9.1", () => {
  it("SDK-9.1-01 denali admin canPerformOperatorSurface settings.mutate", () => {
    const authz = buildTenantAuthz({
      userId: "u-admin",
      tenantId: DENALI_TENANT,
      role: "admin",
      status: "ACTIVE",
      workspaceId: DENALI_WORKSPACE,
    });
    assert.equal(typeof authz.canManageTenant(DENALI_TENANT), "boolean");
    assert.fail("SCAFFOLD: add canPerformOperatorSurface to TenantAuthz — DEC-P9-004");
  });

  it("SDK-9.1-04 urban admin denied urban.settings.update (owner only)", () => {
    const authz = buildTenantAuthz({
      userId: "u-admin",
      tenantId: DENALI_TENANT,
      role: "admin",
      status: "ACTIVE",
      workspaceId: DENALI_WORKSPACE,
    });
    assert.equal(typeof authz.context.role, "string");
    assert.fail("SCAFFOLD: urban admin must not pass canPerformUrbanOwnerMutation");
  });
});
