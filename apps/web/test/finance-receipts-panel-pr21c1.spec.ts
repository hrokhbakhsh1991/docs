/**
 * PR21-D — receipts panel deep UX refinement (structural).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-receipts-panel PR21-D", () => {
  it("PR21-D: compact money glance, collapsible proof, decision-bound consequence", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    const review = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-receipt-review-content.tsx"),
      "utf8"
    );
    assert.doesNotMatch(panel, /FinanceInvoiceBalanceCard/);
    assert.match(panel, /FinanceReceiptReviewContent/);
    assert.match(panel, /FINANCE_RECEIPTS_TEST_IDS\.reviewResult/);
    assert.match(panel, /router\.refresh\(\)/);
    assert.match(review, /ReceiptMoneyGlance/);
    assert.match(review, /classifyReceiptAmountAgainstRemaining/);
    assert.match(review, /remainingAfterApproveMinor/);
    assert.match(review, /FINANCE_RECEIPTS_TEST_IDS\.financialContext/);
    assert.match(review, /FINANCE_RECEIPTS_TEST_IDS\.amountFit/);
    assert.match(review, /FINANCE_RECEIPTS_TEST_IDS\.approveConsequence/);
    assert.match(review, /FINANCE_RECEIPTS_TEST_IDS\.afterApprovePreview/);
    assert.match(review, /FINANCE_RECEIPTS_TEST_IDS\.proofToggle/);
    assert.match(review, /proofOpen/);
    assert.match(review, /showProof/);
    assert.match(review, /hideProof/);
    assert.match(review, /approving/);
    assert.match(review, /rejecting/);
    assert.match(review, /variant="ghost"/);
    assert.match(review, /receipt\.payment\?\.currency \?\? invoice\?\.currency \?\? ""/);
    assert.doesNotMatch(review, /receipt\.payment\?\.currency \?\? invoice\?\.currency \?\? "IRR"/);
  });

  it("PR21-D: FA result copy does not leak Latin unpaid", () => {
    const fa = readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8");
    const receipts = JSON.parse(fa).receipts as Record<string, string>;
    assert.equal(typeof receipts.resultRejected, "string");
    assert.equal(typeof receipts.resultUnpaid, "string");
    assert.doesNotMatch(receipts.resultRejected, /\bunpaid\b/i);
    assert.doesNotMatch(receipts.resultUnpaid, /\bunpaid\b/i);
    assert.match(receipts.resultRejected, /پرداخت/);
    assert.match(receipts.afterApproveRemaining, /مانده|باقی/);
  });

  it("PR21-C1 / G2: booking strip receipts + payments links preserve registrationId", () => {
    const strip = readFileSync(
      resolve(WEB_ROOT, "src/finance/booking-financial-strip.tsx"),
      "utf8"
    );
    const inspection = readFileSync(
      resolve(WEB_ROOT, "src/features/bookings/booking-inspection-details.tsx"),
      "utf8"
    );
    assert.match(strip, /withFinanceRegistrationQuery/);
    assert.match(strip, /\/finance\?tab=receipts/);
    assert.match(strip, /\/finance\?tab=payments/);
    assert.match(inspection, /BookingFinancialStrip/);
    assert.match(inspection, /booking\.id/);
    assert.doesNotMatch(strip, /href=["']\/finance\?tab=receipts["']/);
  });

  it("PR21-D: shared receipt review fails soft when invoice lookup is unavailable", () => {
    const review = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-receipt-review-content.tsx"),
      "utf8"
    );
    assert.match(review, /fetchRegistrationInvoice\(registrationId\)/);
    assert.match(review, /\.catch\(\(\) => \{/);
    assert.match(review, /setInvoice\(null\)/);
    assert.match(review, /setInvoiceLoaded\(true\)/);
  });
});
