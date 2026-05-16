import assert from "node:assert/strict";
import test from "node:test";
import { assertValidPaymentTransition, PaymentTransitionForbiddenError } from "./assert-valid-payment-transition";
import { canPaymentTransition } from "./payment-transition-rules";
import { PaymentStatus } from "./payment-status";

test("canPaymentTransition allows listed edges", () => {
  assert.equal(canPaymentTransition(PaymentStatus.INITIATED, PaymentStatus.PENDING), true);
  assert.equal(canPaymentTransition(PaymentStatus.AUTHORIZED, PaymentStatus.CAPTURED), true);
  assert.equal(canPaymentTransition(PaymentStatus.CAPTURED, PaymentStatus.REFUNDED), true);
});

test("canPaymentTransition rejects illegal edges", () => {
  assert.equal(canPaymentTransition(PaymentStatus.INITIATED, PaymentStatus.CAPTURED), false);
  assert.equal(canPaymentTransition(PaymentStatus.FAILED, PaymentStatus.PENDING), false);
  assert.equal(canPaymentTransition(PaymentStatus.REFUNDED, PaymentStatus.CAPTURED), false);
});

test("assertValidPaymentTransition throws on illegal move", () => {
  assert.throws(
    () => assertValidPaymentTransition(PaymentStatus.REFUNDED, PaymentStatus.CAPTURED),
    (e) => e instanceof PaymentTransitionForbiddenError
  );
});

test("assertValidPaymentTransition allows no-op same state", () => {
  assert.doesNotThrow(() =>
    assertValidPaymentTransition(PaymentStatus.AUTHORIZED, PaymentStatus.AUTHORIZED)
  );
});
