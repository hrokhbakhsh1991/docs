/**
 * PR20-B — SoT booking payment status from post-approve balanceDueMinor.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bookingPaymentStatusFromBalanceDue,
  resolveApproveBookingPaymentStatus,
} from "../src/domain/index.ts";

describe("PR20-B bookingPaymentStatusFromBalanceDue", () => {
  it("balance > 0 → partial", () => {
    assert.equal(bookingPaymentStatusFromBalanceDue("1000000"), "partial");
  });

  it("balance 0 → paid", () => {
    assert.equal(bookingPaymentStatusFromBalanceDue("0"), "paid");
  });
});

describe("PR20-B resolveApproveBookingPaymentStatus", () => {
  it("A — underpay: obligation 2500000, paid 1500000 → partial", () => {
    assert.equal(
      resolveApproveBookingPaymentStatus({
        registrationId: "reg-1",
        currency: "IRR",
        prepaymentMinor: "0",
        paidPaymentsMinor: "1500000",
        paymentAmountsMinor: ["1500000"],
        obligationMinor: "2500000",
      }),
      "partial"
    );
  });

  it("B — full pay: obligation 2500000, paid 2500000 → paid", () => {
    assert.equal(
      resolveApproveBookingPaymentStatus({
        registrationId: "reg-1",
        currency: "IRR",
        prepaymentMinor: "0",
        paidPaymentsMinor: "2500000",
        paymentAmountsMinor: ["2500000"],
        obligationMinor: "2500000",
      }),
      "paid"
    );
  });
});
