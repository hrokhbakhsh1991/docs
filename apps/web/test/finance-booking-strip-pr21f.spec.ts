/**
 * PR21-F / PR21-G2 — Booking Strip settlement, next-step, CTA hierarchy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  hasOpenPendingManualPayment,
  resolveStripBookingSettlementSummary,
  resolveStripNextStep,
} from "../src/finance/booking-financial-strip-logic";
import {
  FINANCE_REGISTRATION_CACHE_NS,
  clearFinanceRegistrationCache,
  invalidateFinanceRegistrationCaches,
  readFinanceRegistrationCache,
  writeFinanceRegistrationCache,
} from "../src/finance/finance-registration-fetch-cache";

const WEB_ROOT = join(process.cwd());
const EN = JSON.parse(readFileSync(join(WEB_ROOT, "messages/en/finance.json"), "utf8")) as {
  overview: Record<string, string>;
  payments: Record<string, string>;
};
const FA = JSON.parse(readFileSync(join(WEB_ROOT, "messages/fa/finance.json"), "utf8")) as {
  overview: Record<string, string>;
  payments: Record<string, string>;
};

describe("PR21-F1 Overview attention vocabulary", () => {
  it("pending-manual CTA is Open payment / باز کردن پرداخت; receipt CTA stays Review", () => {
    assert.equal(EN.overview.attentionActionPayment, "Open payment");
    assert.equal(FA.overview.attentionActionPayment, "باز کردن پرداخت");
    assert.equal(EN.overview.attentionActionReceipt, "Review receipt");
    assert.notEqual(EN.overview.attentionActionPayment, EN.overview.attentionActionReceipt);
  });
});

describe("PR21-G2 settlement summary (once, not per row)", () => {
  it("distinguishes recorded payment from partial booking settlement", () => {
    assert.equal(
      resolveStripBookingSettlementSummary({
        bookingPaymentStatus: "partial",
        items: [{ status: "Paid" }],
      }),
      "booking_partial_recorded"
    );
    assert.equal(
      resolveStripBookingSettlementSummary({
        bookingPaymentStatus: "paid",
        financialDisplayState: "WAIVED",
        items: [],
      }),
      "booking_waived"
    );
    assert.equal(
      resolveStripBookingSettlementSummary({
        bookingPaymentStatus: "paid",
        items: [{ status: "Paid" }],
      }),
      "booking_paid"
    );
    assert.equal(
      resolveStripBookingSettlementSummary({
        bookingPaymentStatus: "unpaid",
        items: [{ status: "Pending" }],
      }),
      "booking_unpaid_pending"
    );
    assert.match(EN.payments.stripBookingSettlementPartialRecorded, /partially paid/i);
    assert.doesNotMatch(EN.payments.stripBookingSettlementPartialRecorded, /booking is fully paid/i);
    assert.match(EN.payments.stripBookingSettlementWaived, /No payment is required/i);
    assert.match(FA.payments.stripBookingSettlementWaived, /بدون نیاز به پرداخت/);
    assert.match(FA.payments.stripBookingSettlementPartialRecorded, /جزئی/);
  });
});

describe("PR21-F3 / G2 next-step + CTA hierarchy (superseded routing details in PR22-A)", () => {
  const reg = "00000000-0000-4000-8000-000000000099";

  it("routes unpaid/partial with open Pending to Payments", () => {
    assert.equal(
      resolveStripNextStep({
        bookingStatus: "approved",
        bookingPaymentStatus: "unpaid",
        hasOpenPendingPayment: true,
        hasPendingReceipt: false,
        hasRemainingBalance: true,
        registrationId: reg,
      })?.tab,
      "payments"
    );
    assert.equal(
      resolveStripNextStep({
        bookingStatus: "approved",
        bookingPaymentStatus: "partial",
        hasOpenPendingPayment: true,
        hasPendingReceipt: false,
        hasRemainingBalance: false,
        registrationId: reg,
      })?.tab,
      "payments"
    );
  });

  it("PR22-A: without Pending, remaining balance routes to Payments (not bare Receipts)", () => {
    assert.equal(
      resolveStripNextStep({
        bookingStatus: "approved",
        bookingPaymentStatus: "unpaid",
        hasOpenPendingPayment: false,
        hasPendingReceipt: false,
        hasRemainingBalance: true,
        registrationId: reg,
      })?.tab,
      "payments"
    );
  });

  it("hides next-step when booking paid", () => {
    assert.equal(
      resolveStripNextStep({
        bookingStatus: "approved",
        bookingPaymentStatus: "paid",
        hasOpenPendingPayment: true,
        hasPendingReceipt: true,
        hasRemainingBalance: false,
        registrationId: reg,
      }),
      null
    );
  });

  it("strip hierarchy: settlement once; no View details; primary Open payments only on next-step", () => {
    const stripSrc = readFileSync(join(WEB_ROOT, "src/finance/booking-financial-strip.tsx"), "utf8");
    const inspection = readFileSync(
      join(WEB_ROOT, "src/features/bookings/booking-inspection-details.tsx"),
      "utf8"
    );
    assert.match(stripSrc, /BOOKING_FINANCIAL_STRIP_TEST_IDS\.openPayments/);
    assert.match(stripSrc, /stripNextStepOpenPayments/);
    assert.doesNotMatch(stripSrc, /viewDetails/);
    assert.doesNotMatch(stripSrc, /tOverview/);
    assert.match(stripSrc, /stripLatestPaymentsTitle/);
    assert.match(stripSrc, /resolveStripBookingSettlementSummary/);
    assert.doesNotMatch(stripSrc, /resolveStripSettlementBridge/);
    assert.equal(EN.payments.stripLatestPaymentsTitle, "Latest payments");
    assert.equal(FA.payments.stripLatestPaymentsTitle, "آخرین پرداخت‌ها");
    assert.match(inspection, /BookingFinancialStrip/);
    assert.match(inspection, /BookingActionButtons/);
    const actionsJsx = inspection.indexOf("<BookingActionButtons");
    const stripJsx = inspection.indexOf("<BookingFinancialStrip");
    assert.ok(actionsJsx >= 0 && stripJsx > actionsJsx, "action buttons before finance strip");
    const paymentDisclosure = inspection.match(
      /detailSections\.payment[\s\S]*?<BookingFinancialStrip[\s\S]*?<\/details>/
    );
    assert.ok(paymentDisclosure, "finance strip inside payment disclosure");
    assert.match(stripSrc, /data-cta-tier="primary"/);
    assert.equal(hasOpenPendingManualPayment([{ status: "Pending" }]), true);
  });
});

describe("PR21-F4 finance registration cache invalidation", () => {
  it("invalidates affected registration only after scoped invalidate", () => {
    clearFinanceRegistrationCache();
    const a = "a".repeat(32);
    const b = "b".repeat(32);
    writeFinanceRegistrationCache(FINANCE_REGISTRATION_CACHE_NS.invoiceBalance, a, {
      invoice: { balanceDueMinor: "1" },
    });
    writeFinanceRegistrationCache(FINANCE_REGISTRATION_CACHE_NS.stripPayments, a, [{ id: "1" }]);
    writeFinanceRegistrationCache(FINANCE_REGISTRATION_CACHE_NS.invoiceBalance, b, {
      invoice: { balanceDueMinor: "9" },
    });
    invalidateFinanceRegistrationCaches(a);
    assert.equal(readFinanceRegistrationCache(FINANCE_REGISTRATION_CACHE_NS.invoiceBalance, a), null);
    assert.deepEqual(readFinanceRegistrationCache(FINANCE_REGISTRATION_CACHE_NS.invoiceBalance, b), {
      invoice: { balanceDueMinor: "9" },
    });
    clearFinanceRegistrationCache();
  });
});
