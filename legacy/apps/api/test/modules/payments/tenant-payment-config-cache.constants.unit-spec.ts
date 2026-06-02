import assert from "node:assert/strict";
import test from "node:test";

import {
  parseTenantIdFromPaymentConfigInvalidateChannel,
  tenantPaymentConfigInvalidateChannel,
  TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN,
} from "../../../src/modules/payments/tenant-payment-config-cache.constants";

const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("tenantPaymentConfigInvalidateChannel uses tenant_payment_config:invalidate prefix", () => {
  assert.equal(
    tenantPaymentConfigInvalidateChannel(TENANT_ID),
    `tenant_payment_config:invalidate:${TENANT_ID}`,
  );
});

test("parseTenantIdFromPaymentConfigInvalidateChannel extracts tenant id", () => {
  assert.equal(
    parseTenantIdFromPaymentConfigInvalidateChannel(
      `tenant_payment_config:invalidate:${TENANT_ID}`,
    ),
    TENANT_ID,
  );
});

test("TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN matches per-tenant channels", () => {
  assert.equal(
    TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN,
    "tenant_payment_config:invalidate:*",
  );
});
