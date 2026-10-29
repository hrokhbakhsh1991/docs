import assert from "node:assert/strict";
import test from "node:test";

import { TenantProvisionConflictError } from "../src/internal/provisioning.errors";
import { resolveSecondStagingTenantExistingRecord } from "../scripts/lib/denali-second-staging-identity";

const expected = {
  id: "f0ed9e65-2638-4351-847d-724f87ebbfce",
  subdomain: "denali-qa2",
  workspaceType: "denali",
  status: "active",
};

test("returns null when both the reserved B id and slug are unused", () => {
  assert.equal(resolveSecondStagingTenantExistingRecord(null, null, expected), null);
});

test("accepts only the exact existing B record for idempotent reruns", () => {
  assert.deepEqual(
    resolveSecondStagingTenantExistingRecord(expected, expected, expected),
    expected
  );
});

test("rejects a slug collision without adopting or mutating its tenant", () => {
  const other = { ...expected, id: "00000000-0000-4000-8000-000000000003" };
  assert.throws(
    () => resolveSecondStagingTenantExistingRecord(null, other, expected),
    (error: unknown) =>
      error instanceof TenantProvisionConflictError &&
      error.code === "TENANT_SUBDOMAIN_ALREADY_EXISTS"
  );
});

test("rejects a reserved id collision with another slug", () => {
  const other = { ...expected, subdomain: "another-tenant" };
  assert.throws(
    () => resolveSecondStagingTenantExistingRecord(other, null, expected),
    (error: unknown) =>
      error instanceof TenantProvisionConflictError && error.code === "TENANT_ID_ALREADY_EXISTS"
  );
});

test("rejects inconsistent id and slug lookups", () => {
  const other = { ...expected, id: "00000000-0000-4000-8000-000000000003" };
  assert.throws(() => resolveSecondStagingTenantExistingRecord(expected, other, expected));
});
