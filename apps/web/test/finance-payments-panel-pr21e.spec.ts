/**
 * PR21-E — payments panel UX (structural + logic).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import {
  buildFinancePaymentReceiptsHref,
  isFinancePaymentPaidStatus,
  isFinancePaymentPendingStatus,
  parseFinanceManualPaymentCreateResponse,
  parseFinancePaymentsListResponse,
} from "../src/finance/finance-payments-logic";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-payments PR21-E", () => {
  it("PR21-E: panel list-first, settlement hint, empty states, receipts nav", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-payments-panel.tsx"), "utf8");
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.settlementHint/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.pendingMeaning/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.openReceipts/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.createResult/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.emptyFiltered/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.obligationGlance/);
    assert.match(panel, /buildFinancePaymentReceiptsHref/);
    assert.match(panel, /createResultNext/);
    assert.match(panel, /pendingPaymentMeaning/);
    // PR21-G3: paid scope hint lives in list-level settlementHint (not per-row).
    assert.match(panel, /settlementHint/);
    assert.match(panel, /emptyFiltered/);
    assert.match(panel, /registrationScoped/);
    assert.doesNotMatch(panel, /needs operator review|Needs review/i);
    assert.match(panel, /usePaymentForAdvanced/);
    assert.match(panel, /const EMPTY_FORM: CreateManualPaymentFormState = \{/);
    assert.match(panel, /currency: ""/);
    assert.match(panel, /currency: invoice\.currency/);
    assert.doesNotMatch(panel, /currency: "IRR"/);
    // List card appears before create form in JSX order (queue hygiene).
    const listIdx = panel.indexOf("FINANCE_PAYMENTS_TEST_IDS.list");
    const createRenderIdx = panel.lastIndexOf("{createFormCard}");
    assert.ok(listIdx > 0 && createRenderIdx > listIdx);
  });

  it("PR21-E: identity shows member before tour", () => {
    const identity = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-registration-identity.tsx"),
      "utf8"
    );
    const memberIdx = identity.indexOf("context.memberDisplayName");
    const tourIdx = identity.indexOf("context.tourTitle");
    assert.ok(memberIdx > 0 && tourIdx > memberIdx);
  });

  it("PR21-E: EN/FA distinguish payment Paid from booking settlement", () => {
    const en = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/en/finance.json"), "utf8"));
    const fa = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8"));
    assert.match(en.payments.status.Paid, /this payment|Recorded/i);
    assert.match(en.payments.settlementHint, /remaining balance/i);
    assert.match(en.payments.pendingPaymentMeaning, /does not mean a receipt/i);
    assert.match(en.payments.emptyFiltered, /filter/i);
    assert.notEqual(en.payments.empty, en.payments.emptyFiltered);
    assert.match(en.payments.createManual, /pending manual payment/i);
    assert.match(en.payments.createButton, /pending manual payment/i);
    assert.match(en.payments.empty, /Receipts/i);
    assert.match(en.payments.emptyRegistration, /exception/i);
    assert.match(fa.payments.status.Paid, /این پرداخت/);
    assert.match(fa.payments.settlementHint, /مانده/);
    assert.doesNotMatch(fa.payments.listScopeHint, /\bManual\b/);
    assert.match(fa.payments.emptyFiltered, /فیلتر/);
    assert.match(fa.payments.createManual, /در انتظار/);
    assert.match(fa.payments.createButton, /در انتظار/);
  });

  it("PR21-E: receipts href preserves registrationId", () => {
    const id = randomUUID();
    const href = buildFinancePaymentReceiptsHref(id);
    assert.match(href, /tab=receipts/);
    assert.match(href, new RegExp(`registrationId=${encodeURIComponent(id)}`));
  });

  it("PR21-E: parse create response and pending/paid helpers", () => {
    const id = randomUUID();
    const registrationId = randomUUID();
    const parsed = parseFinanceManualPaymentCreateResponse({
      id,
      registrationId,
      amount: "700000",
      currency: "IRR",
      method: "Manual",
      status: "Pending",
      provider: "manual",
      paidAt: null,
      createdAt: "2026-08-08T12:00:00.000Z",
    });
    assert.ok(parsed !== null);
    assert.equal(parsed?.status, "Pending");
    assert.equal(isFinancePaymentPendingStatus(parsed!.status), true);
    assert.equal(isFinancePaymentPaidStatus("Paid"), true);
    assert.equal(isFinancePaymentPaidStatus("Pending"), false);

    const list = parseFinancePaymentsListResponse({
      items: [{ ...parsed, status: "Paid" }],
    });
    assert.equal(list.items[0]?.status, "Paid");
  });

  it("PR21-E safety: panel does not import FinanceService or finance-core", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-payments-panel.tsx"), "utf8");
    const logic = readFileSync(resolve(WEB_ROOT, "src/finance/finance-payments-logic.ts"), "utf8");
    assert.doesNotMatch(panel, /FinanceService|@app-cloud\/finance-core/);
    assert.doesNotMatch(logic, /FinanceService|@app-cloud\/finance-core/);
  });
});
