import assert from "node:assert/strict";
import test from "node:test";

import { PaymentAttemptStatus } from "./payment-attempt-status";
import {
  assertValidPaymentAttemptTransition,
  PaymentTransitionForbiddenError,
} from "./assert-valid-payment-transition";
import { canPaymentAttemptTransition } from "./payment-transition-rules";

test("canPaymentAttemptTransition allows initiated → pending", () => {
  assert.equal(
    canPaymentAttemptTransition(PaymentAttemptStatus.INITIATED, PaymentAttemptStatus.PENDING),
    true,
  );
});

test("canPaymentAttemptTransition rejects initiated → captured (skip)", () => {
  assert.equal(
    canPaymentAttemptTransition(PaymentAttemptStatus.INITIATED, PaymentAttemptStatus.CAPTURED),
    false,
  );
});

test("assertValidPaymentAttemptTransition throws on illegal edge", () => {
  assert.throws(
    () =>
      assertValidPaymentAttemptTransition(
        PaymentAttemptStatus.REFUNDED,
        PaymentAttemptStatus.CAPTURED,
      ),
    PaymentTransitionForbiddenError,
  );
});
