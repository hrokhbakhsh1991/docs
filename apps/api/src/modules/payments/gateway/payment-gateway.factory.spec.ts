import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";

import { PaymentGatewayFactory } from "./payment-gateway.factory";
import type { ResolvedPaymentGatewayCredentials } from "./payment-gateway-credentials.types";

function makeTenantPaymentConfigService(
  resolve: (tenantId: string, provider: string) => Promise<ResolvedPaymentGatewayCredentials>,
) {
  return { resolveForProvider: resolve };
}

test("forTenant(zibal) throws when merchant is missing", async () => {
  const config = {
    getNodeEnv: () => "development",
  };
  const factory = new PaymentGatewayFactory(
    {} as never,
    {} as never,
    {} as never,
    makeTenantPaymentConfigService(async () => ({
      provider: "zibal",
      zibal: { merchantId: "", callbackUrl: "https://example.com/cb" },
    })) as never,
    config as never,
  );
  await assert.rejects(() => factory.forTenant("tenant-a", "zibal"), BadRequestException);
});

test("forTenant(zibal) throws when callback URL is missing", async () => {
  const config = {
    getNodeEnv: () => "development",
  };
  const factory = new PaymentGatewayFactory(
    {} as never,
    {} as never,
    {} as never,
    makeTenantPaymentConfigService(async () => ({
      provider: "zibal",
      zibal: { merchantId: "123456", callbackUrl: "" },
    })) as never,
    config as never,
  );
  await assert.rejects(() => factory.forTenant("tenant-a", "zibal"), BadRequestException);
});

test("forTenant(stripe) uses placeholder when secret is empty", async () => {
  const placeholder = { providerId: "stripe_placeholder" };
  const config = {
    getNodeEnv: () => "development",
  };
  const factory = new PaymentGatewayFactory(
    {} as never,
    placeholder as never,
    {} as never,
    makeTenantPaymentConfigService(async () => ({
      provider: "stripe",
      stripe: { secretKey: "" },
    })) as never,
    config as never,
  );
  const gateway = await factory.forTenant("tenant-a", "stripe");
  assert.equal(gateway, placeholder);
});

test("forTenant(mock) throws in production", async () => {
  const config = {
    getNodeEnv: () => "production",
  };
  const factory = new PaymentGatewayFactory(
    {} as never,
    {} as never,
    {} as never,
    makeTenantPaymentConfigService(async () => ({ provider: "mock" })) as never,
    config as never,
  );
  await assert.rejects(() => factory.forTenant("tenant-a", "mock_provider"), BadRequestException);
});

test("forTenant(stripe) prefers live gateway when secret is set", async () => {
  const placeholder = { providerId: "stripe_placeholder" };
  const config = {
    getNodeEnv: () => "development",
  };
  const factory = new PaymentGatewayFactory(
    {} as never,
    placeholder as never,
    { runOnce: async (_scope: unknown, fn: () => Promise<unknown>) => ({ value: await fn() }) } as never,
    makeTenantPaymentConfigService(async () => ({
      provider: "stripe",
      stripe: { secretKey: "sk_test_123" },
    })) as never,
    config as never,
  );
  const gateway = await factory.forTenant("tenant-a", "stripe");
  assert.equal(gateway.providerId, "stripe");
  assert.notEqual(gateway, placeholder);
});

test("forTenant uses tenant-scoped secret over env fallback path", async () => {
  const config = {
    getNodeEnv: () => "development",
  };
  let resolvedTenant = "";
  const factory = new PaymentGatewayFactory(
    {} as never,
    {} as never,
    { runOnce: async (_scope: unknown, fn: () => Promise<unknown>) => ({ value: await fn() }) } as never,
    makeTenantPaymentConfigService(async (tenantId) => {
      resolvedTenant = tenantId;
      return {
        provider: "stripe",
        stripe: { secretKey: "sk_test_tenant" },
      };
    }) as never,
    config as never,
  );
  await factory.forTenant("Tenant-UUID", "stripe");
  assert.equal(resolvedTenant, "tenant-uuid");
});
