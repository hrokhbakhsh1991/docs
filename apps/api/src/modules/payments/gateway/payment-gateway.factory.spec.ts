import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { PaymentGatewayFactory } from "./payment-gateway.factory";

test("forProvider(zibal) throws when merchant is missing", () => {
  const config = {
    getStripeSecretKey: () => "",
    getZibalMerchant: () => "",
    getZibalCallbackUrl: () => "https://example.com/cb"
  };
  const factory = new PaymentGatewayFactory(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    config as never
  );
  assert.throws(() => factory.forProvider("zibal"), BadRequestException);
});

test("forProvider(zibal) throws when callback URL is missing", () => {
  const config = {
    getStripeSecretKey: () => "",
    getZibalMerchant: () => "123456",
    getZibalCallbackUrl: () => ""
  };
  const factory = new PaymentGatewayFactory(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    config as never
  );
  assert.throws(() => factory.forProvider("zibal"), BadRequestException);
});

test("forProvider(stripe) uses placeholder when secret is empty", () => {
  const placeholder = { providerId: "stripe_placeholder" };
  const live = { providerId: "stripe_live" };
  const config = {
    getStripeSecretKey: () => "",
    getZibalMerchant: () => "",
    getZibalCallbackUrl: () => ""
  };
  const factory = new PaymentGatewayFactory(
    {} as never,
    placeholder as never,
    live as never,
    {} as never,
    config as never
  );
  assert.equal(factory.forProvider("stripe"), placeholder);
});

test("forProvider(stripe) prefers live gateway when secret is set", () => {
  const placeholder = { providerId: "stripe_placeholder" };
  const live = { providerId: "stripe_live" };
  const config = {
    getStripeSecretKey: () => "sk_test_123",
    getZibalMerchant: () => "",
    getZibalCallbackUrl: () => ""
  };
  const factory = new PaymentGatewayFactory(
    {} as never,
    placeholder as never,
    live as never,
    {} as never,
    config as never
  );
  assert.equal(factory.forProvider("stripe"), live);
});
