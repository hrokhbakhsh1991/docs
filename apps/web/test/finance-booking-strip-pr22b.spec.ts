/**
 * PR22-B — Booking strip action hierarchy (primary / secondary / tertiary).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { resolveStripNextStep } from "../src/finance/booking-financial-strip-logic";

const WEB_ROOT = join(process.cwd());
const REG = "00000000-0000-4000-8000-000000000099";
const strip = readFileSync(join(WEB_ROOT, "src/finance/booking-financial-strip.tsx"), "utf8");
const EN = JSON.parse(readFileSync(join(WEB_ROOT, "messages/en/finance.json"), "utf8")) as {
  payments: Record<string, string>;
};
const FA = JSON.parse(readFileSync(join(WEB_ROOT, "messages/fa/finance.json"), "utf8")) as {
  payments: Record<string, string>;
};

describe("PR22-B booking strip action hierarchy", () => {
  it("A: partial + balance due → primary Payments (decision order)", () => {
    assert.equal(
      resolveStripNextStep({
        bookingStatus: "approved",
        bookingPaymentStatus: "partial",
        hasOpenPendingPayment: false,
        hasPendingReceipt: false,
        hasRemainingBalance: true,
        registrationId: REG,
      })?.tab,
      "payments"
    );
  });

  it("B: pending payment → primary Payments", () => {
    assert.equal(
      resolveStripNextStep({
        bookingStatus: "approved",
        bookingPaymentStatus: "unpaid",
        hasOpenPendingPayment: true,
        hasPendingReceipt: false,
        hasRemainingBalance: true,
        registrationId: REG,
      })?.tab,
      "payments"
    );
  });

  it("C: pending receipt only → primary Receipts", () => {
    assert.equal(
      resolveStripNextStep({
        bookingStatus: "approved",
        bookingPaymentStatus: "partial",
        hasOpenPendingPayment: false,
        hasPendingReceipt: true,
        hasRemainingBalance: false,
        registrationId: REG,
      })?.tab,
      "receipts"
    );
  });

  it("D: paid → no next-step; settled read-only; no primary Open payments", () => {
    assert.equal(
      resolveStripNextStep({
        bookingStatus: "approved",
        bookingPaymentStatus: "paid",
        hasOpenPendingPayment: false,
        hasPendingReceipt: false,
        hasRemainingBalance: false,
        registrationId: REG,
      }),
      null
    );
    assert.match(strip, /isSettledBooking/);
    assert.match(strip, /BOOKING_FINANCIAL_STRIP_TEST_IDS\.settledReadOnly/);
    assert.match(strip, /stripSettledReadOnly/);
    // No fallback primary Open payments when nextStep null
    assert.doesNotMatch(
      strip,
      /nextStep === null && !loading[\s\S]{0,120}stripNextStepOpenPayments/
    );
    assert.match(EN.payments.stripSettledReadOnly, /Settled|read-only/i);
    assert.match(FA.payments.stripSettledReadOnly, /تسویه‌شده|خواندنی/);
  });

  it("E: Meaning remains tertiary read-only", () => {
    assert.match(EN.payments.stripTertiaryMeaning, /read-only/i);
    assert.match(FA.payments.stripTertiaryMeaning, /فقط خواندنی/);
    assert.match(strip, /data-nav-tier="tertiary"/);
    assert.match(strip, /booking-strip-commercial-meaning-link/);
    assert.match(strip, /BOOKING_FINANCIAL_STRIP_TEST_IDS\.tertiaryMeaning/);
    assert.match(strip, /stripTertiaryMeaning/);
  });

  it("hierarchy: primary CTA tier; secondary Receipts when Payments primary; history when settled/receipts", () => {
    assert.match(strip, /data-cta-tier="primary"/);
    assert.match(strip, /BOOKING_FINANCIAL_STRIP_TEST_IDS\.secondaryNav/);
    assert.match(strip, /nextStep\?\.tab === "payments"/);
    assert.match(strip, /stripSecondaryReceipts/);
    assert.match(strip, /stripPaymentHistory/);
    // Receipts/Meaning no longer sit as equal peers beside Latest payments title
    assert.doesNotMatch(strip, /tTabs\("receipts"\)/);
    assert.doesNotMatch(strip, /tCommand\("viewCommercialMeaning"\)/);
    assert.doesNotMatch(strip, /FinanceService|@app-cloud\/finance-core/);
  });
});
