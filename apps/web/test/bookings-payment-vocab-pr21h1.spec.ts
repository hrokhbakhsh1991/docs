/**
 * PR21-H1 — booking settlement vocabulary (H0-01 / H0-02).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("bookings payment vocabulary PR21-H1", () => {
  const en = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/en/bookings.json"), "utf8"));
  const fa = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/fa/bookings.json"), "utf8"));

  it("H0-02: payment.* and timeline.paymentValue.* stay aligned (EN/FA)", () => {
    for (const status of ["unpaid", "partial", "paid", "waived"] as const) {
      assert.equal(en.payment[status], en.timeline.paymentValue[status]);
      assert.equal(fa.payment[status], fa.timeline.paymentValue[status]);
    }
  });

  it("H0-02: partial is not bare جزئی / Partial", () => {
    assert.notEqual(fa.payment.partial, "جزئی");
    assert.match(fa.payment.partial, /پرداخت جزئی/);
    assert.match(fa.payment.partial, /رزرو/);
    assert.notEqual(en.payment.partial, "Partial");
    assert.match(en.payment.partial, /Partially paid/i);
    assert.match(en.payment.partial, /booking/i);
  });

  it("H0-01: paid and waived booking labels stay distinct", () => {
    assert.equal(fa.payment.paid, "وجه دریافت شد");
    assert.equal(en.payment.paid, "Payment received");
    assert.equal(fa.payment.waived, "بدون نیاز به پرداخت");
    assert.equal(en.payment.waived, "No payment required");
    assert.notEqual(fa.payment.paid, fa.payment.waived);
    assert.notEqual(en.payment.paid, en.payment.waived);
    assert.doesNotMatch(fa.payment.paid, /این پرداخت/);
    assert.doesNotMatch(en.payment.paid, /this payment/i);
    const financeFa = JSON.parse(
      readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8")
    );
    assert.match(financeFa.payments.status.Paid, /این پرداخت/);
    assert.notEqual(fa.payment.paid, financeFa.payments.status.Paid);
  });

  it("H0-01: inspection/timeline field labels say booking settlement", () => {
    assert.equal(fa.fields.payment, "تسویه رزرو");
    assert.equal(fa.timeline.payment, "تسویه رزرو");
    assert.equal(en.fields.payment, "Booking settlement");
    assert.equal(en.timeline.payment, "Booking settlement");
  });

  it("H1: inbox and inspection both render canonical payment display labels", () => {
    const inbox = readFileSync(
      resolve(WEB_ROOT, "src/features/bookings/booking-inbox-row.tsx"),
      "utf8"
    );
    const inspection = readFileSync(
      resolve(WEB_ROOT, "src/features/bookings/booking-inspection-details.tsx"),
      "utf8"
    );
    assert.match(inbox, /bookingPaymentLabelKey\(item\)/);
    assert.match(inspection, /bookingPaymentLabelKey\(booking\)/);
    assert.match(inbox, /paymentBadgeInbox/);
    assert.match(inspection, /paymentBadgeInspection/);
  });

  it("H1 safety: no FinanceService / finance-core in booking badge modules", () => {
    for (const rel of [
      "src/features/bookings/booking-inbox-row.tsx",
      "src/features/bookings/booking-inspection-details.tsx",
      "src/features/bookings/bookings-badge-variants.ts",
    ]) {
      const src = readFileSync(resolve(WEB_ROOT, rel), "utf8");
      assert.doesNotMatch(src, /FinanceService|@app-cloud\/finance-core/);
    }
  });
});
