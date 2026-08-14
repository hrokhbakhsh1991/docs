/**
 * Phase 9.7 R1 — receipt review logic (CP-9.7-08).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildReviewReceiptRequestBody,
  classifyReceiptAmountAgainstRemaining,
  isBrowserReachableReceiptUrl,
  isReceiptImageFileKey,
  isReceiptPdfFileKey,
  parseFinancePendingReceiptsResponse,
  parseFinanceReceiptReviewResponse,
  parseFinanceReceiptUrlPayload,
  receiptFileLabel,
  remainingAfterApproveMinor,
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

  it("WEB-9.7-REC-02b parseFinanceReceiptReviewResponse surfaces bookingPaymentStatus", () => {
    const parsed = parseFinanceReceiptReviewResponse({
      id: "rcpt-1",
      status: "Approved",
      reviewNote: null,
      reviewedAt: "2026-07-18T12:00:00.000Z",
      ledgerJournalId: randomUUID(),
      bookingPaymentStatus: "paid",
    });
    assert.ok(parsed !== null);
    assert.equal(parsed?.bookingPaymentStatus, "paid");
    assert.equal(parsed?.status, "Approved");
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

  it("WEB-9.7-REC-05 image/pdf detection and reachable URL", () => {
    assert.equal(isReceiptImageFileKey("receipts/x/proof.JPG"), true);
    assert.equal(isReceiptImageFileKey("receipts/x/proof.pdf"), false);
    assert.equal(isReceiptPdfFileKey("receipts/x/proof.pdf"), true);
    assert.equal(isBrowserReachableReceiptUrl("https://cdn.example/proof.jpg"), true);
    assert.equal(isBrowserReachableReceiptUrl("/api/finance/receipts/r1/file"), true);
    assert.equal(
      isBrowserReachableReceiptUrl("/internal/finance/receipts/1/file?key=a"),
      false
    );
  });

  it("WEB-9.7-REC-06 parseFinanceReceiptUrlPayload", () => {
    const parsed = parseFinanceReceiptUrlPayload({
      receiptId: "r1",
      fileKey: "receipts/r1/a.jpg",
      url: "https://cdn.example/a.jpg",
    });
    assert.equal(parsed?.url, "https://cdn.example/a.jpg");
    assert.equal(parseFinanceReceiptUrlPayload({}), null);
  });

  it("PR21-C1: classifyReceiptAmountAgainstRemaining under/exact/over", () => {
    assert.equal(classifyReceiptAmountAgainstRemaining("1000000", "2500000"), "under");
    assert.equal(classifyReceiptAmountAgainstRemaining("2500000", "2500000"), "exact");
    assert.equal(classifyReceiptAmountAgainstRemaining("3000000", "2500000"), "over");
    assert.equal(classifyReceiptAmountAgainstRemaining("x", "2500000"), "unknown");
  });

  it("PR21-C1: remainingAfterApproveMinor for under and exact", () => {
    assert.equal(remainingAfterApproveMinor("1000000", "2500000"), "1500000");
    assert.equal(remainingAfterApproveMinor("2500000", "2500000"), "0");
    assert.equal(remainingAfterApproveMinor("3000000", "2500000"), null);
  });
});
