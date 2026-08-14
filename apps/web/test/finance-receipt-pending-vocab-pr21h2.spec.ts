/**
 * PR21-H2 — receipt pending vs payment pending vocabulary.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance receipt pending vocabulary PR21-H2", () => {
  const en = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/en/finance.json"), "utf8"));
  const fa = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8"));
  const dashFa = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/fa/dashboard.json"), "utf8"));
  const dashEn = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/en/dashboard.json"), "utf8"));

  it("receipt Pending is review-scoped, not bare Pending / در انتظار", () => {
    assert.notEqual(en.receipts.status.Pending, "Pending");
    assert.match(en.receipts.status.Pending, /review/i);
    assert.match(en.receipts.status.Pending, /receipt/i);
    assert.notEqual(fa.receipts.status.Pending, "در انتظار");
    assert.match(fa.receipts.status.Pending, /بررسی/);
    assert.match(fa.receipts.status.Pending, /فیش/);
  });

  it("payment Pending stays payment-scoped and differs from receipt Pending", () => {
    assert.match(en.payments.status.Pending, /this payment/i);
    assert.match(fa.payments.status.Pending, /این پرداخت/);
    assert.notEqual(en.receipts.status.Pending, en.payments.status.Pending);
    assert.notEqual(fa.receipts.status.Pending, fa.payments.status.Pending);
    assert.doesNotMatch(en.receipts.status.Pending, /this payment/i);
    assert.doesNotMatch(fa.receipts.status.Pending, /این پرداخت/);
  });

  it("empty receipt queue copy describes absence of receipts awaiting review", () => {
    assert.match(en.receipts.empty, /awaiting review/i);
    assert.match(en.receipts.empty, /receipt/i);
    assert.match(fa.receipts.empty, /در انتظار بررسی/);
    assert.match(fa.receipts.empty, /فیش/);
  });

  it("command-bridge loader and dashboard KPI use review wording", () => {
    assert.match(en.commandBridge.loadingReceipts, /awaiting review/i);
    assert.match(fa.commandBridge.loadingReceipts, /در انتظار بررسی/);
    assert.match(dashEn.finance.kpi["pending-receipts"], /awaiting review/i);
    assert.match(dashFa.finance.kpi["pending-receipts"], /در انتظار بررسی/);
  });

  it("receipts panel renders distinct receipt vs payment status test ids", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    const review = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-receipt-review-content.tsx"),
      "utf8"
    );
    const logic = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-logic.ts"), "utf8");
    assert.match(logic, /receiptStatus:\s*"finance-receipt-status"/);
    assert.match(panel, /FinanceReceiptReviewContent/);
    assert.match(review, /FINANCE_RECEIPTS_TEST_IDS\.receiptStatus/);
    assert.match(review, /FINANCE_RECEIPTS_TEST_IDS\.paymentStatus/);
    assert.match(review, /resolveFinanceReceiptStatusLabel/);
    assert.match(review, /resolvePaymentStatusLabel\(tPayments/);
  });

  it("H2 safety: no FinanceService / finance-core in receipts panel", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    assert.doesNotMatch(panel, /FinanceService|@app-cloud\/finance-core/);
  });
});
