/**
 * PR21-G3 — payments list density & operator flow (structural).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import {
  FINANCE_PAYMENTS_TEST_IDS,
  buildFinancePaymentReceiptsHref,
} from "../src/finance/finance-payments-logic";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-payments PR21-G3", () => {
  const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-payments-panel.tsx"), "utf8");
  const identity = readFileSync(
    resolve(WEB_ROOT, "src/finance/finance-registration-identity.tsx"),
    "utf8"
  );

  it("G3-1: compact row structure (density + amount/status column)", () => {
    assert.match(panel, /density="compact"/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.row/);
    assert.match(identity, /density === "compact"/);
    assert.match(panel, /data-payment-status=\{row\.status\}/);
  });

  it("G3-2: meaning copy is list-level, not per-row paid/pending paragraphs", () => {
    assert.match(panel, /hasVisiblePending/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.pendingMeaning/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.settlementHint/);
    assert.doesNotMatch(panel, /paidPaymentScopeHint/);
    // Per-row pending meaning removed — only list-level hasVisiblePending block.
    const rowFnStart = panel.indexOf("function PaymentRow");
    const rowFnEnd = panel.indexOf("export function FinancePaymentsPanel");
    const rowBody = panel.slice(rowFnStart, rowFnEnd);
    assert.doesNotMatch(rowBody, /pendingPaymentMeaning/);
    assert.doesNotMatch(rowBody, /paidPaymentScopeHint/);
  });

  it("G3-3: Advanced is secondary; Receipts remains normal path", () => {
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.rowAdvanced/);
    assert.match(panel, /rowAdvancedShow/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.openReceipts/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.usePaymentForReceipt/);
    const receiptsIdx = panel.indexOf("FINANCE_PAYMENTS_TEST_IDS.openReceipts");
    const advancedIdx = panel.indexOf("FINANCE_PAYMENTS_TEST_IDS.rowAdvanced");
    const useIdx = panel.indexOf("FINANCE_PAYMENTS_TEST_IDS.usePaymentForReceipt");
    assert.ok(receiptsIdx > 0 && advancedIdx > receiptsIdx && useIdx > advancedIdx);
  });

  it("G3-4: create near-header affordance without moving create above list card", () => {
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.createOpen/);
    assert.match(panel, /openCreateForm/);
    assert.match(panel, /createDetailsRef\.current\.open = true/);
    assert.doesNotMatch(panel, /open=\{!registrationScoped\}/);
    const listIdx = panel.indexOf("FINANCE_PAYMENTS_TEST_IDS.list");
    const createRenderIdx = panel.lastIndexOf("{createFormCard}");
    assert.ok(listIdx > 0 && createRenderIdx > listIdx);
  });

  it("G3-5: scoped obligation glance retained; no per-row invoice fetch", () => {
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.obligationGlance/);
    assert.match(panel, /registrationScoped && scopedInvoice/);
    const rowFnStart = panel.indexOf("function PaymentRow");
    const rowFnEnd = panel.indexOf("export function FinancePaymentsPanel");
    const rowBody = panel.slice(rowFnStart, rowFnEnd);
    assert.doesNotMatch(rowBody, /fetchRegistrationInvoice|invoice/);
    // List render maps rows without invoice calls.
    assert.match(panel, /visibleItems\.map\(\(row\) => \(\s*<PaymentRow/);
  });

  it("G3-6: scoped identity reuses list registrationContext (no new fetch)", () => {
    assert.match(panel, /scopedListIdentity/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.scopedIdentity/);
    assert.doesNotMatch(panel, /fetchRegistrationContext|\/registration-context/);
  });

  it("G3-7: empty/filter/create contracts + receipts registrationId + advanced prefill", () => {
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.emptyFiltered/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.createResult/);
    assert.match(panel, /onUseForAdvancedReceipt\(row\.id, row\.registrationId\)/);
    const id = randomUUID();
    const href = buildFinancePaymentReceiptsHref(id);
    assert.match(href, new RegExp(`registrationId=${encodeURIComponent(id)}`));
    assert.equal(FINANCE_PAYMENTS_TEST_IDS.row, "finance-payment-row");
    assert.equal(FINANCE_PAYMENTS_TEST_IDS.rowAdvanced, "finance-payment-row-advanced");
  });

  it("G3 safety: panel does not import FinanceService or finance-core", () => {
    assert.doesNotMatch(panel, /FinanceService|@app-cloud\/finance-core/);
  });
});
