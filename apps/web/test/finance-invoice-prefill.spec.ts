/**
 * FC-2 — invoice amount prefill helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveSuggestedPaymentAmountMinor,
  type RegistrationInvoice,
} from "../src/finance/finance-invoice-logic";

describe("finance-invoice-prefill.spec.ts — FC-2", () => {
  it("WEB-FC2-01 prefers balanceDueMinor when positive", () => {
    const invoice: RegistrationInvoice = {
      registrationId: "00000000-0000-4000-8000-000000000001",
      currency: "IRR",
      invoiceTotalMinor: "5000000",
      paidAmountMinor: "2000000",
      balanceDueMinor: "3000000",
      walletNetMinor: "0",
    };
    assert.equal(resolveSuggestedPaymentAmountMinor(invoice), "3000000");
  });

  it("WEB-FC2-02 falls back to invoiceTotalMinor when due is zero", () => {
    const invoice: RegistrationInvoice = {
      registrationId: "00000000-0000-4000-8000-000000000001",
      currency: "IRR",
      invoiceTotalMinor: "5000000",
      paidAmountMinor: "5000000",
      balanceDueMinor: "0",
      walletNetMinor: "0",
    };
    assert.equal(resolveSuggestedPaymentAmountMinor(invoice), "5000000");
  });
});
