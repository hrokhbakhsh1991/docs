/**
 * PR23-C3 — finance exception operator UI (presentation + safety).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_EXCEPTION_TYPE,
  FINANCE_EXCEPTIONS_TEST_IDS,
  exceptionMeaningI18nKey,
  exceptionTypeI18nKey,
  hasExceptionReceiptsHref,
  parseFinanceExceptionsResponse,
  sanitizeFinanceExceptionHref,
  toExceptionRegistrationContext,
} from "../src/finance/finance-exceptions-logic.ts";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function sampleE1() {
  return {
    id: "REJECTED_RECEIPT_PENDING_PAYMENT:pay-1",
    type: FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT,
    severity: "attention",
    registrationId: "reg-1",
    identity: {
      memberDisplayName: "Ada",
      tourTitle: "Alborz",
      tourId: "tour-1",
    },
    payment: {
      id: "pay-1",
      status: "Pending",
      amount: "1000000",
      currency: "IRR",
      method: "Manual",
    },
    reason: "blurry",
    balanceDueMinor: "1500000",
    bookingPaymentStatus: "unpaid",
    href: {
      payments: "/finance?tab=payments&registrationId=reg-1",
      receipts: "/finance?tab=receipts&registrationId=reg-1",
    },
    occurredAt: "2026-08-01T10:00:00.000Z",
  };
}

function sampleE2() {
  return {
    id: "CANCELLED_PAYMENT_WITH_BALANCE:pay-2",
    type: FINANCE_EXCEPTION_TYPE.CANCELLED_PAYMENT_WITH_BALANCE,
    severity: "attention",
    registrationId: "reg-2",
    identity: {
      memberDisplayName: null,
      tourTitle: null,
      tourId: null,
    },
    payment: {
      id: "pay-2",
      status: "Cancelled",
      amount: "900000",
      currency: "IRR",
      method: "Manual",
    },
    reason: "abandoned",
    balanceDueMinor: "2500000",
    bookingPaymentStatus: "partial",
    href: {
      payments: "/finance?tab=payments&registrationId=reg-2",
    },
    occurredAt: "2026-08-02T10:00:00.000Z",
  };
}

describe("finance-exceptions PR23-C3", () => {
  it("C3-A — parses E1 and preserves API order (no client re-sort)", () => {
    const page = parseFinanceExceptionsResponse({
      items: [sampleE2(), sampleE1()],
      nextCursor: null,
      hasMore: false,
    });
    assert.equal(page.items.length, 2);
    assert.equal(page.items[0]?.type, FINANCE_EXCEPTION_TYPE.CANCELLED_PAYMENT_WITH_BALANCE);
    assert.equal(page.items[1]?.type, FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT);
    assert.equal(page.items[1]?.reason, "blurry");
    assert.equal(page.items[1]?.href.payments, "/finance?tab=payments&registrationId=reg-1");
    assert.equal(page.items[1]?.href.receipts, "/finance?tab=receipts&registrationId=reg-1");
  });

  it("C3-B — E2 parse keeps Cancelled status and payments href only", () => {
    const page = parseFinanceExceptionsResponse({
      items: [sampleE2()],
      nextCursor: null,
      hasMore: false,
    });
    const item = page.items[0];
    assert.ok(item);
    assert.equal(item.payment.status, "Cancelled");
    assert.equal(item.payment.status === "Failed", false);
    assert.equal(hasExceptionReceiptsHref(item), false);
    assert.equal(item.href.payments.includes("tab=payments"), true);
    assert.equal(item.href.payments.includes("registrationId=reg-2"), true);
  });

  it("C3-B2 — exception payment parser does not invent workspace currency", () => {
    const sample = sampleE1();
    const { currency: _currency, ...paymentWithoutCurrency } = sample.payment;
    const page = parseFinanceExceptionsResponse({
      items: [{ ...sample, payment: paymentWithoutCurrency }],
      nextCursor: null,
      hasMore: false,
    });
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.payment.currency, "");
  });

  it("C3-C — empty / invalid payloads do not invent exceptions", () => {
    assert.deepEqual(parseFinanceExceptionsResponse(null), {
      items: [],
      nextCursor: null,
      hasMore: false,
    });
    assert.equal(parseFinanceExceptionsResponse({ items: [{ type: "MADE_UP" }] }).items.length, 0);
  });

  it("C3-D — href sanitizer rejects external / non-finance paths", () => {
    assert.equal(sanitizeFinanceExceptionHref("/finance?tab=payments"), "/finance?tab=payments");
    assert.equal(sanitizeFinanceExceptionHref("https://evil.example/finance"), null);
    assert.equal(sanitizeFinanceExceptionHref("//evil.example"), null);
    assert.equal(sanitizeFinanceExceptionHref("/bookings"), null);
  });

  it("C3-E — identity mapping and i18n keys for E1/E2", () => {
    const e1 = parseFinanceExceptionsResponse({ items: [sampleE1()] }).items[0]!;
    const e2 = parseFinanceExceptionsResponse({ items: [sampleE2()] }).items[0]!;
    assert.deepEqual(toExceptionRegistrationContext(e1), {
      registrationId: "reg-1",
      tourId: "tour-1",
      tourTitle: "Alborz",
      memberDisplayName: "Ada",
    });
    assert.equal(toExceptionRegistrationContext(e2), null);
    assert.equal(exceptionTypeI18nKey(e1.type), "typeRejectedReceiptPending");
    assert.equal(exceptionMeaningI18nKey(e1.type), "meaningRejectedReceiptPending");
    assert.equal(exceptionTypeI18nKey(e2.type), "typeCancelledWithBalance");
    assert.equal(exceptionMeaningI18nKey(e2.type), "meaningCancelledWithBalance");
  });

  it("C3-F — panel states + copy + safety (no mutation / create / approve)", () => {
    const panel = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-exceptions-panel.tsx"),
      "utf8"
    );
    const logic = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-exceptions-logic.ts"),
      "utf8"
    );
    const overview = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-overview-panel.tsx"),
      "utf8"
    );

    assert.match(panel, /FINANCE_EXCEPTIONS_TEST_IDS\.loading/);
    assert.match(panel, /FINANCE_EXCEPTIONS_TEST_IDS\.empty/);
    assert.match(panel, /FINANCE_EXCEPTIONS_TEST_IDS\.error/);
    assert.match(panel, /FINANCE_EXCEPTIONS_TEST_IDS\.retry/);
    assert.match(logic, /loading:\s*"finance-exceptions-loading"/);
    assert.match(logic, /empty:\s*"finance-exceptions-empty"/);
    assert.match(panel, /openPayments/);
    assert.match(panel, /openReceipts/);
    assert.match(panel, /meaningRejectedReceiptPending|exceptionMeaningI18nKey/);
    assert.match(panel, /meaningCancelledWithBalance|exceptionMeaningI18nKey/);
    assert.match(overview, /FinanceExceptionsFollowUpSection/);

    assert.doesNotMatch(panel, /createManualPayment|Create payment|approve|reviewReceipt/i);
    assert.doesNotMatch(panel, /fetch\([`'"]\/api\/finance\/payments\/manual/);
    assert.doesNotMatch(panel, /\/receipts\/.*\/review/);
    assert.doesNotMatch(logic, /status\s*===\s*["']Pending["'].*Rejected|listPendingReceipts/);
    assert.match(panel, /\/api\/finance\/exceptions/);

    const fa = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8")) as {
      exceptions: Record<string, string>;
    };
    const en = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/en/finance.json"), "utf8")) as {
      exceptions: Record<string, string>;
      errors: Record<string, string>;
    };
    assert.equal(fa.exceptions.empty, "موردی برای پیگیری مالی وجود ندارد");
    assert.equal(en.exceptions.empty, "No finance follow-ups");
    assert.equal(en.exceptions.title, "Follow-ups");
    assert.ok(en.exceptions.openOutstanding);
    assert.match(fa.exceptions.meaningRejectedReceiptPending, /قصد پرداخت/);
    assert.match(en.exceptions.meaningCancelledWithBalance, /cancelled/i);
    assert.match(en.exceptions.typeCancelledWithBalance, /Cancelled/);
    assert.doesNotMatch(en.exceptions.typeCancelledWithBalance, /Failed/);
    assert.match(panel, /exceptionOutstandingHref|openOutstanding/);
    for (const copy of [fa.exceptions, en.exceptions]) {
      for (const value of Object.values(copy)) {
        assert.doesNotMatch(value, /\boverdue\b|\blate\b|\bfailed\b|\bescalat/i);
        assert.doesNotMatch(value, /ناموفق|دیرکرد|معوق|تشدید/);
      }
    }
    assert.match(en.errors.EXCEPTIONS_FETCH_FAILED, /follow-ups/i);
  });

  it("C3-G — Cancelled vocabulary stays distinct from Failed in payments status keys", () => {
    const en = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/en/finance.json"), "utf8")) as {
      payments: { status: Record<string, string> };
    };
    assert.match(en.payments.status.Cancelled, /Cancelled/i);
    assert.doesNotMatch(en.payments.status.Cancelled, /Failed/i);
    assert.notEqual(en.payments.status.Cancelled, en.payments.status.Failed);
  });
});
