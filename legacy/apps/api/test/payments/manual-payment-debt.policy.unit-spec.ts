import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import {
  assertManualPaymentDebtAllowed,
  PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN
} from "../../src/modules/payments/domain/manual-payment-debt.policy";
import { PaymentStatus } from "../../src/modules/payments/entities/payment.entity";

test("allows manual debt when no prior payments", () => {
  assert.doesNotThrow(() => assertManualPaymentDebtAllowed([]));
});

test("allows manual debt after online failure (Failed only)", () => {
  assert.doesNotThrow(() => assertManualPaymentDebtAllowed([PaymentStatus.FAILED]));
});

test("rejects manual debt when a Paid payment exists", () => {
  assert.throws(
    () => assertManualPaymentDebtAllowed([PaymentStatus.PAID]),
    (err: unknown) => {
      assert.ok(err instanceof ConflictException);
      assert.deepEqual(err.getResponse(), PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN);
      return true;
    }
  );
});

test("rejects manual debt when a Pending payment exists", () => {
  assert.throws(
    () => assertManualPaymentDebtAllowed([PaymentStatus.PENDING]),
    (err: unknown) => {
      assert.ok(err instanceof ConflictException);
      const body = err.getResponse() as { error?: { code?: string } };
      assert.equal(body.error?.code, "PAYMENT_PENDING_EXISTS");
      return true;
    }
  );
});
