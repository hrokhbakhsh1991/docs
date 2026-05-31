import assert from "node:assert/strict";
import test from "node:test";

import {
  isTenantPaymentConfigMutationQuery,
  resolveTenantIdsFromCriteria,
  resolveTenantIdsFromPaymentConfigQuery,
} from "../../../src/modules/payments/subscribers/tenant-payment-config-mutation-resolver";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ROW_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("isTenantPaymentConfigMutationQuery detects update/delete/insert only", () => {
  assert.equal(
    isTenantPaymentConfigMutationQuery(
      `UPDATE "tenant_payment_configs" SET "api_key" = $1 WHERE "tenant_id" = $2`,
    ),
    true,
  );
  assert.equal(
    isTenantPaymentConfigMutationQuery(`SELECT * FROM "tenant_payment_configs" WHERE "tenant_id" = $1`),
    false,
  );
});

test("resolveTenantIdsFromPaymentConfigQuery maps tenant_id parameter index", async () => {
  const tenantIds = await resolveTenantIdsFromPaymentConfigQuery(
    `UPDATE "tenant_payment_configs" SET "api_key" = $1 WHERE "tenant_id" = $2`,
    ["sk_live", TENANT_A],
    { findOne: async () => null } as never,
  );
  assert.deepEqual(tenantIds, [TENANT_A]);
});

test("resolveTenantIdsFromCriteria resolves tenantId directly", async () => {
  const tenantIds = await resolveTenantIdsFromCriteria(
    { tenantId: TENANT_A, provider: "stripe" },
    { findOne: async () => null } as never,
  );
  assert.deepEqual(tenantIds, [TENANT_A]);
});

test("resolveTenantIdsFromCriteria resolves tenantId via row id lookup", async () => {
  const tenantIds = await resolveTenantIdsFromCriteria(
    { id: ROW_ID },
    {
      findOne: async () => ({ tenantId: TENANT_A }),
    } as never,
  );
  assert.deepEqual(tenantIds, [TENANT_A]);
});
