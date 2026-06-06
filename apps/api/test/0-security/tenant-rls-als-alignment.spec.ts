/**
 * DEC-028 — ALS-bound tenant must match withTenantRls / withCanonicalTransaction target.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertActiveTenantMatchesRlsTarget,
  TENANT_RLS_ALS_TENANT_MISMATCH,
} from "../../src/db/assert-tenant-rls-alignment";
import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

describe("tenant RLS ↔ ALS alignment (P1-4)", () => {
  it("allows RLS target when ALS is unbound", () => {
    assert.doesNotThrow(() => assertActiveTenantMatchesRlsTarget(integrationTenantId()));
  });

  it("allows RLS target when ALS matches", async () => {
    const tenantId = integrationTenantId();
    await runWithTenantContext(tenantId, async () => {
      assert.doesNotThrow(() => assertActiveTenantMatchesRlsTarget(tenantId));
    });
  });

  it("rejects mismatched ALS vs RLS tenant", async () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    await runWithTenantContext(tenantA, async () => {
      assert.throws(
        () => assertActiveTenantMatchesRlsTarget(tenantB),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, TENANT_RLS_ALS_TENANT_MISMATCH);
          return true;
        }
      );
    });
  });
});
