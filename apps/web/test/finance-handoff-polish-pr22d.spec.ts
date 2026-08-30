/**
 * PR22-D — customer handoff polish (guidance, amount-fit, reject nav).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(process.cwd());
const EN = JSON.parse(readFileSync(join(WEB_ROOT, "messages/en/finance.json"), "utf8"));
const FA = JSON.parse(readFileSync(join(WEB_ROOT, "messages/fa/finance.json"), "utf8"));
const bookingsFa = JSON.parse(readFileSync(join(WEB_ROOT, "messages/fa/bookings.json"), "utf8"));
const shell = readFileSync(join(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"), "utf8");
const panel = readFileSync(join(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
const review = readFileSync(
  join(WEB_ROOT, "src/finance/finance-receipt-review-content.tsx"),
  "utf8"
);

describe("PR22-D finance customer handoff polish", () => {
  it("vocabulary regression: payment / booking / receipt pending stay distinct", () => {
    assert.match(FA.payments.status.Paid, /ثبت‌شده \(این پرداخت\)/);
    assert.match(FA.payments.status.Pending, /در انتظار \(این پرداخت\)/);
    assert.match(FA.receipts.status.Pending, /در انتظار بررسی \(فیش\)/);
    assert.equal(bookingsFa.payment.paid, "وجه دریافت شد");
    assert.match(FA.commandCenter.operatorStateVocabBookingPaid, /پرداخت‌شده \(رزرو\)/);
    assert.notEqual(FA.payments.status.Pending, FA.receipts.status.Pending);
    assert.notEqual(FA.payments.status.Paid, bookingsFa.payment.paid);
    assert.notEqual(FA.commandCenter.operatorStateVocabBookingPaid, bookingsFa.payment.paid);
    assert.match(EN.commandCenter.operatorStateVocabRecorded, /Recorded \(this payment\)/i);
    assert.match(EN.commandCenter.operatorStateVocabBookingPaid, /Paid \(booking\)/i);
    assert.match(EN.commandCenter.operatorStateVocabPaymentPending, /Pending \(this payment\)/i);
    assert.match(EN.commandCenter.operatorStateVocabReceiptPending, /Pending review \(receipt\)/i);
    assert.match(FA.commandCenter.operatorStateVocabRecorded, /ثبت‌شده \(این پرداخت\)/);
    assert.match(FA.commandCenter.operatorStateVocabPaymentPending, /در انتظار \(این پرداخت\)/);
    assert.match(FA.commandCenter.operatorStateVocabReceiptPending, /در انتظار بررسی \(فیش\)/);
  });

  it("amount-fit under is balance-oriented, not bare جزئی / Partial", () => {
    assert.notEqual(FA.receipts.amountFitUnder, "جزئی");
    assert.match(FA.receipts.amountFitUnder, /مانده/);
    assert.notEqual(EN.receipts.amountFitUnder, "Partial");
    assert.match(EN.receipts.amountFitUnder, /remaining|balance/i);
  });

  it("operator state → action guide on first-customer chrome", () => {
    assert.match(shell, /finance-operator-state-guide/);
    assert.match(shell, /firstCustomerOpsChrome \? \(/);
    assert.match(shell, /operatorStateUnpaid/);
    assert.match(shell, /operatorStatePartial/);
    assert.match(shell, /operatorStatePendingPayment/);
    assert.match(shell, /operatorStatePendingReceipt/);
    assert.match(shell, /operatorStatePaid/);
    assert.match(EN.commandCenter.operatorStatePendingReceipt, /Receipts/i);
    assert.match(FA.commandCenter.operatorStatePendingPayment, /پرداخت‌ها/);
  });

  it("reject result navigates to Payments with existing registrationId (no new fetch)", () => {
    assert.match(panel, /reviewResultOpenPayment/);
    assert.match(panel, /resultRejectedOpenPayment/);
    assert.match(panel, /lastResult\.decision === "reject"/);
    assert.match(panel, /withFinanceRegistrationQuery\(\s*"\/finance\?tab=payments"/);
    assert.match(panel, /registrationId:/);
    assert.match(review, /paymentId:/);
    // Must not introduce a new fetch on reject banner render
    assert.doesNotMatch(
      panel,
      /reviewResultOpenPayment[\s\S]{0,400}fetch\(/
    );
    assert.match(EN.receipts.resultRejectedOpenPayment, /Open related payment/i);
    assert.match(FA.receipts.resultRejectedOpenPayment, /پرداخت مرتبط/);
  });

  it("safety: no FinanceService / finance-core in handoff surfaces", () => {
    assert.doesNotMatch(shell, /FinanceService|@app-cloud\/finance-core/);
    assert.doesNotMatch(panel, /FinanceService|@app-cloud\/finance-core/);
  });
});
