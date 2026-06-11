/**
 * Phase 9.7 R1 — receipt review logic (CP-9.7-08).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildReviewReceiptRequestBody,
  parseFinancePendingReceiptsResponse,
  receiptFileLabel,
  validateReviewReceiptForm,
} from "../src/finance/finance-receipts-logic";

describe("finance-receipts-logic.spec.ts — Phase 9.7 R1", () => {
  it("WEB-9.7-REC-01 parseFinancePendingReceiptsResponse normalizes queue", () => {
    const paymentId = randomUUID();
    const parsed = parseFinancePendingReceiptsResponse({
      items: [
        {
          id: "rcpt-1",
          paymentId,
          fileKey: "receipts/pay/proof.jpg",
          status: "Pending",
          note: "bank transfer",
          createdAt: "2026-06-09T12:00:00.000Z",
          payment: {
            id: paymentId,
            registrationId: randomUUID(),
            amount: "1000000",
            currency: "IRR",
            method: "Manual",
            status: "Pending",
          },
        },
      ],
    });
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0]?.payment?.amount, "1000000");
  });

  it("WEB-9.7-REC-02 validateReviewReceiptForm accepts approve", () => {
    const result = validateReviewReceiptForm({
      decision: "approve",
      reviewNote: "verified",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const body = buildReviewReceiptRequestBody(result.value);
      assert.equal(body.decision, "approve");
      assert.equal(body.reviewNote, "verified");
    }
  });

  it("WEB-9.7-REC-03 validateReviewReceiptForm omits empty review note", () => {
    const result = validateReviewReceiptForm({ decision: "reject", reviewNote: "  " });
    assert.equal(result.ok, true);
    if (result.ok) {
      const body = buildReviewReceiptRequestBody(result.value);
      assert.equal(body.reviewNote, undefined);
    }
  });

  it("WEB-9.7-REC-04 receiptFileLabel returns basename", () => {
    assert.equal(receiptFileLabel("receipts/pay/proof.jpg"), "proof.jpg");
  });
});
