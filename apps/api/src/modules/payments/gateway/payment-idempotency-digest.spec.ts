import assert from "node:assert/strict";
import test from "node:test";
import { paymentGatewayIdempotencyDigest } from "./payment-idempotency-key.store";

test("paymentGatewayIdempotencyDigest isolates tenants with the same client idempotency key", () => {
  const scopeA = {
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    operation: "stripe:create_payment_intent",
    idempotencyKey: "shared-client-key",
  };
  const scopeB = {
    tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    operation: "stripe:create_payment_intent",
    idempotencyKey: "shared-client-key",
  };

  const digestA = paymentGatewayIdempotencyDigest(scopeA);
  const digestB = paymentGatewayIdempotencyDigest(scopeB);
  assert.notEqual(digestA, digestB);
  assert.match(digestA, /^[a-f0-9]{64}$/);
});

test("paymentGatewayIdempotencyDigest isolates operations within the same tenant", () => {
  const base = {
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    idempotencyKey: "shared-client-key",
  };
  const stripe = paymentGatewayIdempotencyDigest({
    ...base,
    operation: "stripe:create_payment_intent",
  });
  const zibal = paymentGatewayIdempotencyDigest({
    ...base,
    operation: "zibal:create_payment_intent",
  });
  assert.notEqual(stripe, zibal);
});
