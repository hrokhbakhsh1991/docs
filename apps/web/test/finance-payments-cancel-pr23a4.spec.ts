/**
 * PR23-A4 — Pending manual payment cancel UI (logic + structural).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import {
  FINANCE_PAYMENTS_TEST_IDS,
  buildCancelPendingManualPaymentPath,
  buildCancelPendingManualPaymentRequestBody,
  createFinanceIdempotencyKey,
  isManualPendingPaymentCancellable,
  isFinancePaymentCancelledStatus,
  mapCancelPendingManualPaymentHttpError,
  parseCancelPendingManualPaymentResponse,
  paymentStatusTone,
  validateCancelPendingManualPaymentForm,
} from "../src/finance/finance-payments-logic";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-payments cancel PR23-A4", () => {
  it("A — Pending manual without pending receipt is cancellable", () => {
    assert.equal(
      isManualPendingPaymentCancellable({
        method: "Manual",
        status: "Pending",
        hasPendingReceipt: false,
      }),
      true
    );
  });

  it("B — Paid payment is not cancellable", () => {
    assert.equal(
      isManualPendingPaymentCancellable({
        method: "Manual",
        status: "Paid",
        hasPendingReceipt: false,
      }),
      false
    );
  });

  it("C — Gateway / non-manual is not cancellable", () => {
    assert.equal(
      isManualPendingPaymentCancellable({
        method: "Online",
        status: "Pending",
        hasPendingReceipt: false,
      }),
      false
    );
    assert.equal(
      isManualPendingPaymentCancellable({
        method: "Manual",
        status: "Pending",
        hasPendingReceipt: true,
      }),
      false
    );
  });

  it("D — Cancel success parse updates Cancelled status", () => {
    const paymentId = randomUUID();
    const parsed = parseCancelPendingManualPaymentResponse({
      paymentId,
      status: "Cancelled",
      cancellationEventId: `payment-cancelled:${paymentId}`,
      occurredAt: "2026-01-15T12:00:00.000Z",
      reasonCode: "abandoned",
      replay: false,
    });
    assert.ok(parsed !== null);
    assert.equal(parsed?.status, "Cancelled");
    assert.equal(isFinancePaymentCancelledStatus(parsed!.status), true);
    assert.equal(paymentStatusTone("Cancelled"), "default");
    assert.notEqual(paymentStatusTone("Cancelled"), paymentStatusTone("Failed"));
  });

  it("E — reason other requires note", () => {
    assert.deepEqual(
      validateCancelPendingManualPaymentForm({ reasonCode: "other", reasonNote: "" }),
      { ok: false, error: "REASON_NOTE_REQUIRED" }
    );
    const ok = validateCancelPendingManualPaymentForm({
      reasonCode: "other",
      reasonNote: "operator note",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.deepEqual(buildCancelPendingManualPaymentRequestBody(ok.value), {
        reasonCode: "other",
        reasonNote: "operator note",
      });
    }
  });

  it("F — 409 conflict maps to state-aware codes", () => {
    assert.equal(
      mapCancelPendingManualPaymentHttpError(409, { code: "PAYMENT_HAS_PENDING_RECEIPT" }),
      "PAYMENT_HAS_PENDING_RECEIPT"
    );
    assert.equal(
      mapCancelPendingManualPaymentHttpError(409, { code: "PAYMENT_NOT_CANCELLABLE" }),
      "PAYMENT_NOT_CANCELLABLE"
    );
    assert.equal(
      mapCancelPendingManualPaymentHttpError(404, { code: "PAYMENT_NOT_FOUND" }),
      "PAYMENT_NOT_FOUND"
    );
  });

  it("G — panel sends Idempotency-Key on cancel", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-payments-panel.tsx"), "utf8");
    assert.match(panel, /Idempotency-Key/);
    assert.match(panel, /buildCancelPendingManualPaymentPath/);
    assert.match(panel, /createFinanceIdempotencyKey/);
    const key = createFinanceIdempotencyKey("cancel-test");
    assert.match(key, /^cancel-test-/);
  });

  it("H — registration scope preserved (scoped fetches + cache invalidate)", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-payments-panel.tsx"), "utf8");
    assert.match(panel, /receipts\/pending/);
    assert.match(panel, /withFinanceListScopeQuery/);
    assert.match(panel, /invalidateFinanceRegistrationCaches\(cancelTarget\.registrationId\)/);
    const paymentId = randomUUID();
    assert.equal(
      buildCancelPendingManualPaymentPath(paymentId),
      `/api/finance/payments/${encodeURIComponent(paymentId)}/cancel`
    );
  });

  it("vocab — Cancelled ≠ Failed in FA/EN", () => {
    const en = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/en/finance.json"), "utf8"));
    const fa = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8"));
    assert.match(en.payments.status.Cancelled, /Cancelled \(manual payment\)/i);
    assert.match(fa.payments.status.Cancelled, /لغوشده \(پرداخت دستی\)/);
    assert.notEqual(en.payments.status.Cancelled, en.payments.status.Failed);
    assert.notEqual(fa.payments.status.Cancelled, fa.payments.status.Failed);
    assert.doesNotMatch(fa.payments.status.Cancelled, /ناموفق|شکست|برگشت/);
  });

  it("panel — cancel is secondary; dialog + test ids present", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-payments-panel.tsx"), "utf8");
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.cancelOpen/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.cancelDialog/);
    assert.match(panel, /FINANCE_PAYMENTS_TEST_IDS\.cancelConfirm/);
    assert.match(panel, /variant=\"secondary\"/);
    assert.match(panel, /isManualPendingPaymentCancellable/);
    assert.equal(FINANCE_PAYMENTS_TEST_IDS.cancelOpen, "finance-payment-cancel-open");
    const route = readFileSync(
      resolve(WEB_ROOT, "app/api/finance/payments/[paymentId]/cancel/route.ts"),
      "utf8"
    );
    assert.match(route, /proxyFinanceApiPost/);
    assert.match(route, /\/finance\/payments\//);
  });
});
