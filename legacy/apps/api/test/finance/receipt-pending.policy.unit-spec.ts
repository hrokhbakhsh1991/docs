import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { assertNoPendingReceiptForPayment } from "../../src/modules/finance/receipts/receipt-pending.policy";
import { ReceiptStatus } from "../../src/modules/payments/entities/payment-receipt.entity";

test("allows upload when no pending receipt exists", () => {
  assert.doesNotThrow(() =>
    assertNoPendingReceiptForPayment([{ status: ReceiptStatus.APPROVED }])
  );
});

test("rejects when pending receipt already exists", () => {
  assert.throws(
    () => assertNoPendingReceiptForPayment([{ status: ReceiptStatus.PENDING }]),
    (err: unknown) => {
      assert.ok(err instanceof ConflictException);
      const body = err.getResponse() as { error?: { code?: string } };
      assert.equal(body.error?.code, "RECEIPT_PENDING_ALREADY_EXISTS_FOR_PAYMENT");
      return true;
    }
  );
});
