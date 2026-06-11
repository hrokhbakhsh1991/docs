/**
 * Phase 9.7 R1 — manual payments logic (CP-9.7-07).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildCreateManualPaymentRequestBody,
  parseFinancePaymentsListResponse,
  paymentStatusTone,
  validateCreateManualPaymentForm,
  validateSubmitReceiptForm,
} from "../src/finance/finance-payments-logic";

describe("finance-payments-logic.spec.ts — Phase 9.7 R1", () => {
  it("WEB-9.7-PAY-01 parseFinancePaymentsListResponse normalizes rows", () => {
    const parsed = parseFinancePaymentsListResponse({
      items: [
        {
          id: "pay-1",
          registrationId: randomUUID(),
          amount: "1000000",
          currency: "IRR",
          method: "Manual",
          status: "Pending",
          provider: "manual",
          paidAt: null,
          createdAt: "2026-06-09T12:00:00.000Z",
        },
      ],
    });
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0]?.status, "Pending");
  });

  it("WEB-9.7-PAY-02 validateCreateManualPaymentForm rejects invalid amount", () => {
    const result = validateCreateManualPaymentForm({
      registrationId: randomUUID(),
      amount: "0",
      currency: "IRR",
    });
    assert.equal(result.ok, false);
  });

  it("WEB-9.7-PAY-03 validateCreateManualPaymentForm builds request body", () => {
    const registrationId = randomUUID();
    const result = validateCreateManualPaymentForm({
      registrationId,
      amount: "5000000",
      currency: "irr",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const body = buildCreateManualPaymentRequestBody(result.value);
      assert.equal(body.registrationId, registrationId);
      assert.equal(body.currency, "IRR");
    }
  });

  it("WEB-9.7-PAY-04 paymentStatusTone maps Paid to success", () => {
    assert.equal(paymentStatusTone("Paid"), "success");
    assert.equal(paymentStatusTone("Pending"), "warning");
  });

  it("WEB-9.7-PAY-05 validateSubmitReceiptForm validates file key", () => {
    const result = validateSubmitReceiptForm({
      paymentId: randomUUID(),
      fileKey: "",
      note: "",
    });
    assert.equal(result.ok, false);
  });
});
