import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedTourCreateWireKeysForTenant,
  resolveTenantTourFormContract,
} from "./tenant-tour-form-contract";

test("resolveTenantTourFormContract enables finance and form_builder surfaces", () => {
  const c = resolveTenantTourFormContract(["finance", "form_builder"]);
  assert.equal(c.allowFinanceSurfaces, true);
  assert.equal(c.allowAdvancedTripDetails, true);
  assert.deepEqual(c.tenantModules, ["finance", "form_builder"]);
});

test("resolveTenantTourFormContract ignores unknown module ids", () => {
  const c = resolveTenantTourFormContract(["finance", "unknown_module"]);
  assert.deepEqual(c.tenantModules, ["finance"]);
  assert.equal(c.allowFinanceSurfaces, true);
  assert.equal(c.allowAdvancedTripDetails, false);
});

test("allowedTourCreateWireKeysForTenant returns shared contract fields", () => {
  const c = resolveTenantTourFormContract([]);
  const keys = allowedTourCreateWireKeysForTenant(c);
  assert.ok(keys.includes("title"));
  assert.ok(keys.length > 5);
});
