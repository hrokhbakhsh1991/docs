import assert from "node:assert/strict";
import test from "node:test";
import { FakePaymentGateway } from "./fake-payment-gateway";

test("FakePaymentGateway returns same providerPaymentId for duplicate idempotency key", async () => {
  const gw = new FakePaymentGateway();
  const intent = {
    tenantId: "t1",
    idempotencyKey: "idem-1",
    amountMinor: "1000",
    currency: "USD",
    bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  };
  const a = await gw.createPaymentIntent(intent);
  const b = await gw.createPaymentIntent(intent);
  assert.equal(a.providerPaymentId, b.providerPaymentId);
  assert.equal(b.idempotentReplay, true);
  assert.equal(a.idempotentReplay, false);
});

test("FakePaymentGateway refund respects idempotency key", async () => {
  const gw = new FakePaymentGateway();
  const req = {
    tenantId: "t1",
    idempotencyKey: "r1",
    providerPaymentId: "fake_pi_abc",
    amountMinor: "500"
  };
  const a = await gw.refundPayment(req);
  const b = await gw.refundPayment(req);
  assert.equal(a.providerRefundId, b.providerRefundId);
});
