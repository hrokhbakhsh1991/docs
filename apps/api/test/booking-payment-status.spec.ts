/**
 * Booking payment projection raise helper (finance → bookings sync).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { raiseBookingPaymentStatus } from "../src/bookings/booking-payment-status.ts";

describe("booking-payment-status.spec.ts", () => {
  it("BPAY-01 raises unpaid → partial → paid and never downgrades", () => {
    assert.equal(raiseBookingPaymentStatus("unpaid", "partial"), "partial");
    assert.equal(raiseBookingPaymentStatus("unpaid", "paid"), "paid");
    assert.equal(raiseBookingPaymentStatus("partial", "paid"), "paid");
    assert.equal(raiseBookingPaymentStatus("paid", "partial"), "paid");
    assert.equal(raiseBookingPaymentStatus("paid", "unpaid"), "paid");
    assert.equal(raiseBookingPaymentStatus("partial", "unpaid"), "partial");
  });
});
