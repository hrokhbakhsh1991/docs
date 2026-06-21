/**
 * Phase 9.7 R2 — invoice balance compile (CP-9.7-11).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { compileRegistrationInvoice } from "../src/workspace-finance/compile-invoice-balances";

describe("compile-invoice-balances.spec.ts — Phase 9.7 R2", () => {
  it("API-9.7-R2-INV-01 paidAmountMinor caps at invoice total", () => {
    const registrationId = randomUUID();
    const invoice = compileRegistrationInvoice({
      registrationId,
      currency: "IRR",
      prepaymentMinor: "6000000",
      paidPaymentsMinor: "2000000",
      paymentAmountsMinor: ["5000000"],
      scheduleAmountsMinor: ["10000000"],
    });
    assert.equal(invoice.invoiceTotalMinor, "10000000");
    assert.equal(invoice.walletNetMinor, "8000000");
    assert.equal(invoice.paidAmountMinor, "8000000");
    assert.equal(invoice.balanceDueMinor, "2000000");
  });

  it("API-9.7-R2-INV-02 wallet exceeding invoice is clamped", () => {
    const invoice = compileRegistrationInvoice({
      registrationId: randomUUID(),
      currency: "IRR",
      prepaymentMinor: "12000000",
      paidPaymentsMinor: "0",
      paymentAmountsMinor: ["10000000"],
      scheduleAmountsMinor: [],
    });
    assert.equal(invoice.paidAmountMinor, "10000000");
    assert.equal(invoice.balanceDueMinor, "0");
  });

  it("API-9.7-R2-INV-03 schedule total takes precedence over payment sum", () => {
    const invoice = compileRegistrationInvoice({
      registrationId: randomUUID(),
      currency: "IRR",
      prepaymentMinor: "0",
      paidPaymentsMinor: "0",
      paymentAmountsMinor: ["5000000"],
      scheduleAmountsMinor: ["9000000", "1000000"],
    });
    assert.equal(invoice.invoiceTotalMinor, "10000000");
    assert.equal(invoice.balanceDueMinor, "10000000");
  });
});
