import assert from "node:assert/strict";
import test from "node:test";

import { TenantPaymentConfigService } from "../../../src/modules/payments/services/tenant-payment-config.service";

function makeLoggerStub() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  } as never;
}

test("TenantPaymentConfigService falls back to env when tenant row is absent", async () => {
  const service = new TenantPaymentConfigService(
    {
      async findActiveByTenantAndProvider() {
        return null;
      },
    } as never,
    {
      getStripeSecretKey: () => "sk_env_fallback",
      getZibalMerchant: () => "env_merchant",
      getZibalCallbackUrl: () => "https://env.example/cb",
    } as never,
    makeLoggerStub(),
  );

  const stripe = await service.resolveForProvider("tenant-1", "stripe");
  assert.deepEqual(stripe, { provider: "stripe", stripe: { secretKey: "sk_env_fallback" } });

  const zibal = await service.resolveForProvider("tenant-1", "zibal");
  assert.deepEqual(zibal, {
    provider: "zibal",
    zibal: { merchantId: "env_merchant", callbackUrl: "https://env.example/cb" },
  });
});

test("TenantPaymentConfigService prefers tenant row over env fallback", async () => {
  const service = new TenantPaymentConfigService(
    {
      async findActiveByTenantAndProvider(_tenantId: string, provider: string) {
        if (provider === "stripe") {
          return { apiKey: "sk_tenant", merchantId: null, callbackUrl: null };
        }
        return {
          apiKey: null,
          merchantId: "tenant_merchant",
          callbackUrl: "https://tenant.example/cb",
        };
      },
    } as never,
    {
      getStripeSecretKey: () => "sk_env_fallback",
      getZibalMerchant: () => "env_merchant",
      getZibalCallbackUrl: () => "https://env.example/cb",
    } as never,
    makeLoggerStub(),
  );

  const stripe = await service.resolveForProvider("tenant-1", "stripe");
  assert.equal(stripe.provider === "stripe" ? stripe.stripe.secretKey : "", "sk_tenant");

  const zibal = await service.resolveForProvider("tenant-1", "zibal");
  assert.equal(zibal.provider === "zibal" ? zibal.zibal.merchantId : "", "tenant_merchant");
  assert.equal(zibal.provider === "zibal" ? zibal.zibal.callbackUrl : "", "https://tenant.example/cb");
});

test("TenantPaymentConfigService.invalidateTenant emits trace log with origin metadata", async () => {
  const infoCalls: Record<string, unknown>[] = [];
  const service = new TenantPaymentConfigService(
    { async findActiveByTenantAndProvider() { return null; } } as never,
    {
      getStripeSecretKey: () => "sk_env_fallback",
      getZibalMerchant: () => "env_merchant",
      getZibalCallbackUrl: () => "https://env.example/cb",
    } as never,
    {
      debug() {},
      info(_message: string, meta: Record<string, unknown>) {
        infoCalls.push(meta);
      },
      warn() {},
      error() {},
    } as never,
  );

  await service.resolveForProvider("tenant-trace", "stripe");
  service.invalidateTenant("tenant-trace", {
    origin: "subscriber:afterQuery",
    query_preview: "UPDATE tenant_payment_configs",
  });

  assert.equal(infoCalls.length, 1);
  assert.equal(infoCalls[0]?.eviction_origin, "subscriber:afterQuery");
  assert.equal(infoCalls[0]?.tenant_id, "tenant-trace");
  assert.equal(infoCalls[0]?.keys_evicted, 1);
});
