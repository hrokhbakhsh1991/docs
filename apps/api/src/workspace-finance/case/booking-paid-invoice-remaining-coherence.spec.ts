/**
 * PR15-G — booking paid vs invoice remaining coherence (Host Case-read).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isBookingPaidWithPositiveInvoiceRemaining } from "./booking-paid-invoice-remaining-coherence.ts";

describe("isBookingPaidWithPositiveInvoiceRemaining — PR15-G", () => {
  it("A — fully paid (remaining 0) is not a conflict", () => {
    assert.equal(
      isBookingPaidWithPositiveInvoiceRemaining({
        bookingPaymentStatus: "paid",
        remainingMinor: "0",
      }),
      false
    );
  });

  it("B — unpaid / partial booking with remaining is not this conflict", () => {
    assert.equal(
      isBookingPaidWithPositiveInvoiceRemaining({
        bookingPaymentStatus: "unpaid",
        remainingMinor: "900000",
      }),
      false
    );
    assert.equal(
      isBookingPaidWithPositiveInvoiceRemaining({
        bookingPaymentStatus: "partial",
        remainingMinor: "900000",
      }),
      false
    );
  });

  it("C — paid with outstanding obligation is a conflict", () => {
    assert.equal(
      isBookingPaidWithPositiveInvoiceRemaining({
        bookingPaymentStatus: "paid",
        remainingMinor: "900000",
      }),
      true
    );
  });

  it("D — inconsistent / unread remaining does not invent conflict", () => {
    assert.equal(
      isBookingPaidWithPositiveInvoiceRemaining({
        bookingPaymentStatus: "paid",
        remainingMinor: null,
      }),
      false
    );
    assert.equal(
      isBookingPaidWithPositiveInvoiceRemaining({
        bookingPaymentStatus: "paid",
        remainingMinor: undefined,
      }),
      false
    );
    assert.equal(
      isBookingPaidWithPositiveInvoiceRemaining({
        bookingPaymentStatus: null,
        remainingMinor: "900000",
      }),
      false
    );
  });
});
