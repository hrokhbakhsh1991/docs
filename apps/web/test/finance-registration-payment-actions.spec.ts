/**
 * Workspace finance registration-scoped action surface contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  resolve(WEB_ROOT, "src/finance/finance-registration-payment-actions.tsx"),
  "utf8"
);

describe("finance-registration-payment-actions.spec.ts", () => {
  it("uses registration-scoped callbacks and can suppress child banners", () => {
    assert.match(source, /showActionBanner\?: boolean/);
    assert.match(source, /showActionBanner = true/);
    assert.match(source, /onChanged\?: \(event: FinanceRegistrationPaymentActionEvent\) => void/);
    assert.match(source, /kind: "manual_payment_created"/);
    assert.match(source, /kind: "receipt_submitted"/);
  });

  it("resets local form and banner state when registration changes", () => {
    assert.match(source, /useEffect\(\(\) => \{/);
    assert.match(source, /setAmount\(""\)/);
    assert.match(source, /setCurrency\("IRR"\)/);
    assert.match(source, /setActionBanner\(null\)/);
    assert.match(source, /setReceiptForm\(EMPTY_RECEIPT_FORM\)/);
    assert.match(source, /setAdvancedOpen\(false\)/);
    assert.match(source, /amountPrefilledRef\.current = null/);
    assert.match(source, /\}, \[normalizedRegistrationId\]\)/);
  });

  it("renders a success banner for receipt submission with receipts deep-link", () => {
    assert.match(source, /finance-registration-receipt-submit-result/);
    assert.match(source, /receiptSubmittedTitle/);
    assert.match(source, /receiptSubmittedNext/);
    assert.match(source, /buildFinancePaymentReceiptsHref/);
  });

  it("keeps advanced receipt submission behind an explicit disclosure block", () => {
    assert.match(source, /<details/);
    assert.match(source, /open=\{advancedOpen\}/);
    assert.match(source, /data-testid="finance-submit-receipt-advanced"/);
    assert.match(source, /submitReceiptShowAdvanced/);
    assert.match(source, /setAdvancedOpen\(\(event\.target as HTMLDetailsElement\)\.open\)/);
    assert.match(source, /data-testid=\{FINANCE_PAYMENTS_TEST_IDS\.receiptForm\}/);
  });

  it("reopens the advanced receipt path after a manual payment is created", () => {
    assert.match(source, /setReceiptForm\(\(current\) => \(\{/);
    assert.match(source, /paymentId: created\.id\.length > 0 \? created\.id : current\.paymentId/);
    assert.match(source, /setAdvancedOpen\(true\)/);
  });

  it("stays UI-only and does not import finance service internals", () => {
    assert.doesNotMatch(source, /FinanceService|finance-core|runReviewReceiptCommandBridge/);
    assert.match(source, /validateCreateManualPaymentForm/);
    assert.match(source, /validateSubmitReceiptForm/);
    assert.match(source, /parseFinanceReceiptCreateResponse/);
    assert.match(source, /type FinanceRegistrationPaymentActionEvent/);
  });
});
