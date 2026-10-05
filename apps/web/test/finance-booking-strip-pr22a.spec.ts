/**
 * PR22-A — Booking strip next-action decision order + CTA hierarchy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  hasInvoiceRemainingBalance,
  resolveStripBookingSettlementSummary,
  resolveStripRefundStatus,
  resolveStripNextStep,
} from "../src/finance/booking-financial-strip-logic";

const WEB_ROOT = join(process.cwd());
const REG = "00000000-0000-4000-8000-000000000099";
const strip = readFileSync(join(WEB_ROOT, "src/finance/booking-financial-strip.tsx"), "utf8");
const EN = JSON.parse(readFileSync(join(WEB_ROOT, "messages/en/finance.json"), "utf8")) as {
  payments: Record<string, string>;
};
const FA = JSON.parse(readFileSync(join(WEB_ROOT, "messages/fa/finance.json"), "utf8")) as {
  payments: Record<string, string>;
};

describe("PR22-A booking strip next-action", () => {
  it("A: partial + recorded + balance due + no receipt → Payments (remaining_balance)", () => {
    const plan = resolveStripNextStep({
      bookingStatus: "approved",
      bookingPaymentStatus: "partial",
      hasOpenPendingPayment: false,
      hasPendingReceipt: false,
      hasRemainingBalance: true,
      registrationId: REG,
    });
    assert.equal(plan?.tab, "payments");
    assert.equal(plan?.reason, "remaining_balance");
    assert.match(plan?.href ?? "", /tab=payments/);
    assert.match(plan?.href ?? "", new RegExp(`registrationId=${encodeURIComponent(REG)}`));
  });

  it("B: pending payment → Payments", () => {
    const plan = resolveStripNextStep({
      bookingStatus: "approved",
      bookingPaymentStatus: "unpaid",
      hasOpenPendingPayment: true,
      hasPendingReceipt: false,
      hasRemainingBalance: true,
      registrationId: REG,
    });
    assert.equal(plan?.tab, "payments");
    assert.equal(plan?.reason, "pending_payment");
  });

  it("C: pending receipt only → Receipts", () => {
    const plan = resolveStripNextStep({
      bookingStatus: "approved",
      bookingPaymentStatus: "partial",
      hasOpenPendingPayment: false,
      hasPendingReceipt: true,
      hasRemainingBalance: true,
      registrationId: REG,
    });
    assert.equal(plan?.tab, "receipts");
    assert.equal(plan?.reason, "pending_receipt");
    assert.match(plan?.href ?? "", /tab=receipts/);
  });

  it("D: fully paid → no CTA", () => {
    assert.equal(
      resolveStripNextStep({
        bookingStatus: "approved",
        bookingPaymentStatus: "paid",
        hasOpenPendingPayment: true,
        hasPendingReceipt: true,
        hasRemainingBalance: false,
        registrationId: REG,
      }),
      null
    );
  });

  it("E: partial + pending payment + pending receipt → Payments with neutral reason", () => {
    const plan = resolveStripNextStep({
      bookingStatus: "approved",
      bookingPaymentStatus: "partial",
      hasOpenPendingPayment: true,
      hasPendingReceipt: true,
      hasRemainingBalance: true,
      registrationId: REG,
    });
    assert.equal(plan?.tab, "payments");
    assert.equal(plan?.reason, "pending_payment_with_receipt");
    assert.match(EN.payments.stripNextStepPaymentsNeutralHint, /receipt/i);
    assert.match(FA.payments.stripNextStepPaymentsNeutralHint, /فیش/);
    assert.doesNotMatch(EN.payments.stripNextStepPaymentsNeutralHint, /ignore|wrong/i);
  });

  it("pending payment beats pending receipt; remaining does not beat pending receipt", () => {
    assert.equal(
      resolveStripNextStep({
        bookingStatus: "approved",
        bookingPaymentStatus: "unpaid",
        hasOpenPendingPayment: true,
        hasPendingReceipt: true,
        hasRemainingBalance: true,
        registrationId: REG,
      })?.tab,
      "payments"
    );
    assert.equal(
      resolveStripNextStep({
        bookingStatus: "approved",
        bookingPaymentStatus: "unpaid",
        hasOpenPendingPayment: false,
        hasPendingReceipt: true,
        hasRemainingBalance: true,
        registrationId: REG,
      })?.tab,
      "receipts"
    );
  });

  it("hasInvoiceRemainingBalance parses minor amounts", () => {
    assert.equal(hasInvoiceRemainingBalance("1000000"), true);
    assert.equal(hasInvoiceRemainingBalance("0"), false);
    assert.equal(hasInvoiceRemainingBalance(null), false);
    assert.equal(hasInvoiceRemainingBalance("x"), false);
  });

  it("terminal cancellation wins over stale paid status", () => {
    assert.equal(
      resolveStripBookingSettlementSummary({
        bookingPaymentStatus: "paid",
        bookingStatus: "cancelled",
        refundStatus: "Completed",
        items: [],
      }),
      "booking_refunded"
    );
    assert.equal(
      resolveStripBookingSettlementSummary({
        bookingPaymentStatus: "paid",
        bookingStatus: "cancelled",
        refundStatus: "Approved",
        items: [],
      }),
      "booking_refund_pending"
    );
    assert.equal(
      resolveStripBookingSettlementSummary({
        bookingPaymentStatus: "paid",
        bookingStatus: "cancelled",
        items: [],
      }),
      "booking_cancelled"
    );
  });

  it("aggregates every refund row and keeps an open remainder ahead of completed rows", () => {
    assert.equal(resolveStripRefundStatus(["Completed", "Requested"]), "Requested");
    assert.equal(resolveStripRefundStatus(["Completed", "Approved"]), "Approved");
    assert.equal(resolveStripRefundStatus(["Completed", "Completed"]), "Completed");
    assert.equal(resolveStripRefundStatus(["Rejected", "Cancelled"]), null);
  });

  it("strip: one primary CTA; payments next-step clickable; no always-on Payments when next-step", () => {
    assert.match(strip, /data-next-reason=\{nextStep\.reason\}/);
    assert.match(strip, /stripNextStepPaymentsNeutralHint|paymentsNextStepHintKey/);
    assert.match(strip, /hasPendingReceipt/);
    assert.match(strip, /hasInvoiceRemainingBalance/);
    assert.match(strip, /fetchRegistrationRefundStatus/);
    assert.match(strip, /limit=100/);
    // PR22-B: openPayments only on primary Payments next-step (not fallback)
    assert.match(
      strip,
      /nextStep\.tab === "payments"[\s\S]*?BOOKING_FINANCIAL_STRIP_TEST_IDS\.openPayments/
    );
    assert.doesNotMatch(strip, /FinanceService|@app-cloud\/finance-core/);
  });
});
