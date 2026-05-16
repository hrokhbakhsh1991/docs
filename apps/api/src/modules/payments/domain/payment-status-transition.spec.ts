import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { assertAllowedPaymentStatusTransition } from "./payment-status-transition";
import { PaymentStatus } from "../entities/payment.entity";

test("PENDING to Paid (captured) allowed", () => {
  assertAllowedPaymentStatusTransition(PaymentStatus.PENDING, PaymentStatus.PAID);
});

test("Paid to Refunded allowed", () => {
  assertAllowedPaymentStatusTransition(PaymentStatus.PAID, PaymentStatus.REFUNDED);
});

test("Paid to Cancelled allowed (outside intent enum)", () => {
  assertAllowedPaymentStatusTransition(PaymentStatus.PAID, PaymentStatus.CANCELLED);
});

test("Pending to Refunded rejected (no skip to refund)", () => {
  assert.throws(
    () => assertAllowedPaymentStatusTransition(PaymentStatus.PENDING, PaymentStatus.REFUNDED),
    ConflictException
  );
});

test("Paid to Pending rejected", () => {
  assert.throws(
    () => assertAllowedPaymentStatusTransition(PaymentStatus.PAID, PaymentStatus.PENDING),
    ConflictException
  );
});
