import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import {
  PaymentIntentLifecycleStatus,
  allowedPaymentIntentNextStates,
  assertAllowedPaymentIntentLifecycleTransition,
  paymentStatusToIntentLifecycle
} from "./payment-intent-lifecycle";
import { PaymentStatus } from "../entities/payment.entity";

test("CREATED may only go to PENDING", () => {
  assertAllowedPaymentIntentLifecycleTransition(
    PaymentIntentLifecycleStatus.CREATED,
    PaymentIntentLifecycleStatus.PENDING
  );
  assert.deepEqual(allowedPaymentIntentNextStates(PaymentIntentLifecycleStatus.CREATED), [
    PaymentIntentLifecycleStatus.PENDING
  ]);
  assert.throws(
    () =>
      assertAllowedPaymentIntentLifecycleTransition(
        PaymentIntentLifecycleStatus.CREATED,
        PaymentIntentLifecycleStatus.CAPTURED
      ),
    ConflictException
  );
  assert.throws(
    () =>
      assertAllowedPaymentIntentLifecycleTransition(
        PaymentIntentLifecycleStatus.CREATED,
        PaymentIntentLifecycleStatus.FAILED
      ),
    ConflictException
  );
});

test("PENDING may only go to CAPTURED or FAILED", () => {
  assertAllowedPaymentIntentLifecycleTransition(
    PaymentIntentLifecycleStatus.PENDING,
    PaymentIntentLifecycleStatus.CAPTURED
  );
  assertAllowedPaymentIntentLifecycleTransition(
    PaymentIntentLifecycleStatus.PENDING,
    PaymentIntentLifecycleStatus.FAILED
  );
  assert.throws(
    () =>
      assertAllowedPaymentIntentLifecycleTransition(
        PaymentIntentLifecycleStatus.PENDING,
        PaymentIntentLifecycleStatus.REFUNDED
      ),
    ConflictException
  );
});

test("CAPTURED may only go to REFUNDED", () => {
  assertAllowedPaymentIntentLifecycleTransition(
    PaymentIntentLifecycleStatus.CAPTURED,
    PaymentIntentLifecycleStatus.REFUNDED
  );
  assert.throws(
    () =>
      assertAllowedPaymentIntentLifecycleTransition(
        PaymentIntentLifecycleStatus.CAPTURED,
        PaymentIntentLifecycleStatus.PENDING
      ),
    ConflictException
  );
});

test("FAILED and REFUNDED are terminal", () => {
  assert.throws(
    () =>
      assertAllowedPaymentIntentLifecycleTransition(
        PaymentIntentLifecycleStatus.FAILED,
        PaymentIntentLifecycleStatus.PENDING
      ),
    ConflictException
  );
  assert.throws(
    () =>
      assertAllowedPaymentIntentLifecycleTransition(
        PaymentIntentLifecycleStatus.REFUNDED,
        PaymentIntentLifecycleStatus.CAPTURED
      ),
    ConflictException
  );
});

test("idempotent intent transition is a no-op", () => {
  assertAllowedPaymentIntentLifecycleTransition(
    PaymentIntentLifecycleStatus.PENDING,
    PaymentIntentLifecycleStatus.PENDING
  );
});

test("paymentStatus maps PAID to CAPTURED intent", () => {
  assert.equal(paymentStatusToIntentLifecycle(PaymentStatus.PAID), PaymentIntentLifecycleStatus.CAPTURED);
  assert.equal(paymentStatusToIntentLifecycle(PaymentStatus.PENDING), PaymentIntentLifecycleStatus.PENDING);
  assert.equal(paymentStatusToIntentLifecycle(PaymentStatus.CANCELLED), null);
});
