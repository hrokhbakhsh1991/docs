import assert from "node:assert/strict";
import test from "node:test";

import {
  isAllowedPaymentStatusTransition,
  PaymentStatus,
  PAYMENT_STATUS_TRANSITIONS,
} from "./finance.schemas";

test("PAYMENT_STATUS_TRANSITIONS matches persisted payment FSM", () => {
  assert.deepEqual(PAYMENT_STATUS_TRANSITIONS.Pending, ["Paid", "Failed"]);
  assert.deepEqual(PAYMENT_STATUS_TRANSITIONS.Paid, ["Refunded", "Cancelled"]);
  assert.equal(isAllowedPaymentStatusTransition("Pending", "Paid"), true);
  assert.equal(isAllowedPaymentStatusTransition("Paid", "Cancelled"), true);
  assert.equal(isAllowedPaymentStatusTransition("Pending", "Refunded"), false);
  assert.equal(isAllowedPaymentStatusTransition(PaymentStatus.PAID, PaymentStatus.PAID), true);
});
