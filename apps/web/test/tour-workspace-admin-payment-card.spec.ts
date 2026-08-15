import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  resolve(WEB_ROOT, "src/features/tours/tour-workspace-admin-payment-card.tsx"),
  "utf8"
);

describe("tour-workspace-admin-payment-card.spec.ts", () => {
  it("keeps workspace payment orchestration inside the tours feature", () => {
    assert.match(source, /fetchRegistrationInvoice/);
    assert.match(source, /fetchTourDetailCached/);
    assert.match(source, /resolveDenaliSuggestedPrepaymentMinor/);
    assert.match(source, /resolveSuggestedPaymentAmountMinor/);
    assert.match(source, /validateRecordPrepaymentForm/);
    assert.doesNotMatch(source, /FinanceService|finance-core|runReviewReceiptCommandBridge/);
  });

  it("simplifies the primary admin-payment path into a single responsibility", () => {
    assert.match(source, /workspacePaymentDescription/);
    assert.match(source, /workspacePaymentHint/);
    assert.match(source, /workspacePaymentButton/);
    assert.match(source, /workspacePaymentRecordedRemaining/);
    assert.match(source, /workspacePaymentRecordedSettled/);
    assert.doesNotMatch(source, /workspaceReceiptAdvancedTitle/);
    assert.doesNotMatch(source, /finance-submit-receipt-advanced/);
  });

  it("prefills payment context without auto-opening the advanced receipt flow", () => {
    assert.match(source, /kind: "prepayment_recorded"/);
    assert.match(source, /\/api\/finance\/prepayments/);
    assert.match(source, /refreshKey/);
    assert.match(source, /tourId/);
    assert.match(source, /readCachedTourDetail/);
    assert.match(source, /FinanceInvoiceBalanceCard[\s\S]*refreshKey=\{refreshKey\}/);
    assert.doesNotMatch(source, /setAdvancedOpen\(true\)/);
  });
});
