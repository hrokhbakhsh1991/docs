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

function makeRedisStub() {
  return {
    async publish() {
      return 1;
    },
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
      getZibalCallbackUrl: () => "https://example.com/env-cb",
    } as never,
    makeLoggerStub(),
    makeRedisStub(),
  );

  const stripe = await service.resolveForProvider("tenant-1", "stripe");
  assert.deepEqual(stripe, { provider: "stripe", stripe: { secretKey: "sk_env_fallback" } });

  const zibal = await service.resolveForProvider("tenant-1", "zibal");
  assert.deepEqual(zibal, {
    provider: "zibal",
    zibal: { merchantId: "env_merchant", callbackUrl: "https://example.com/env-cb" },
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
          callbackUrl: "https://example.com/tenant-cb",
        };
      },
    } as never,
    {
      getStripeSecretKey: () => "sk_env_fallback",
      getZibalMerchant: () => "env_merchant",
      getZibalCallbackUrl: () => "https://example.com/env-cb",
    } as never,
    makeLoggerStub(),
    makeRedisStub(),
  );

  const stripe = await service.resolveForProvider("tenant-1", "stripe");
  assert.equal(stripe.provider === "stripe" ? stripe.stripe.secretKey : "", "sk_tenant");

  const zibal = await service.resolveForProvider("tenant-1", "zibal");
  assert.equal(zibal.provider === "zibal" ? zibal.zibal.merchantId : "", "tenant_merchant");
  assert.equal(zibal.provider === "zibal" ? zibal.zibal.callbackUrl : "", "https://example.com/tenant-cb");
});

test("TenantPaymentConfigService.invalidateTenant emits trace log with origin metadata", async () => {
  const infoCalls: Record<string, unknown>[] = [];
  const service = new TenantPaymentConfigService(
    { async findActiveByTenantAndProvider() { return null; } } as never,
    {
      getStripeSecretKey: () => "sk_env_fallback",
      getZibalMerchant: () => "env_merchant",
      getZibalCallbackUrl: () => "https://example.com/env-cb",
    } as never,
    {
      debug() {},
      info(_message: string, meta: Record<string, unknown>) {
        infoCalls.push(meta);
      },
      warn() {},
      error() {},
    } as never,
    makeRedisStub(),
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

test("TenantPaymentConfigService.publishDistributedInvalidation publishes tenant channel", async () => {
  const publishCalls: Array<{ channel: string; message: string }> = [];
  const service = new TenantPaymentConfigService(
    { async findActiveByTenantAndProvider() { return null; } } as never,
    {
      getStripeSecretKey: () => "sk_env_fallback",
      getZibalMerchant: () => "env_merchant",
      getZibalCallbackUrl: () => "https://example.com/env-cb",
    } as never,
    makeLoggerStub(),
    {
      async publish(channel: string, message: string) {
        publishCalls.push({ channel, message });
        return 1;
      },
    } as never,
  );

  await service.publishDistributedInvalidation("Tenant-ABC");

  assert.deepEqual(publishCalls, [
    {
      channel: "tenant_payment_config:invalidate:tenant-abc",
      message: "tenant-abc",
    },
  ]);
});

test("TenantPaymentConfigService drops stale cache repopulation when generation advances mid-fetch", async () => {
  let fetchCount = 0;
  let releaseFirstFetch: (() => void) | undefined;
  const firstFetchGate = new Promise<void>((resolve) => {
    releaseFirstFetch = resolve;
  });

  const service = new TenantPaymentConfigService(
    {
      async findActiveByTenantAndProvider(_tenantId: string, provider: string) {
        fetchCount += 1;
        if (provider === "stripe" && fetchCount === 1) {
          await firstFetchGate;
          return { apiKey: "sk_stale", merchantId: null, callbackUrl: null };
        }
        return { apiKey: "sk_fresh", merchantId: null, callbackUrl: null };
      },
    } as never,
    {
      getStripeSecretKey: () => "sk_env_fallback",
      getZibalMerchant: () => "env_merchant",
      getZibalCallbackUrl: () => "https://example.com/env-cb",
    } as never,
    makeLoggerStub(),
    makeRedisStub(),
  );

  const pending = service.resolveForProvider("tenant-race", "stripe");
  await new Promise<void>((resolve) => setImmediate(resolve));
  service.invalidateTenant("tenant-race", { origin: "manual" });
  releaseFirstFetch?.();
  const resolved = await pending;

  assert.equal(resolved.provider === "stripe" ? resolved.stripe.secretKey : "", "sk_fresh");
  assert.equal(fetchCount, 2);
});
