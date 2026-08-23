/**
 * Phase 9.7 R2 — invoice read model web logic (CP-9.7-11).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildInvoiceLookupPath,
  parseRegistrationInvoice,
  validateInvoiceLookupRegistrationId,
} from "../src/finance/finance-invoice-logic";

describe("finance-invoice-logic.spec.ts — Phase 9.7 R2", () => {
  it("WEB-9.7-INV-01 parseRegistrationInvoice normalizes balance fields", () => {
    const registrationId = randomUUID();
    const invoice = parseRegistrationInvoice({
      registrationId,
      currency: "IRR",
      invoiceTotalMinor: "10000000",
      paidAmountMinor: "3000000",
      balanceDueMinor: "7000000",
      walletNetMinor: "3000000",
    });
    assert.ok(invoice);
    assert.equal(invoice.balanceDueMinor, "7000000");
  });

  it("WEB-9.7-INV-01b parseRegistrationInvoice does not invent a workspace currency", () => {
    const registrationId = randomUUID();
    const invoice = parseRegistrationInvoice({
      registrationId,
      invoiceTotalMinor: "10000000",
      paidAmountMinor: "3000000",
      balanceDueMinor: "7000000",
      walletNetMinor: "3000000",
    });
    assert.ok(invoice);
    assert.equal(invoice.currency, "");
  });

  it("WEB-9.7-INV-02 validateInvoiceLookupRegistrationId rejects invalid uuid", () => {
    const result = validateInvoiceLookupRegistrationId("bad-id");
    assert.equal(result.ok, false);
  });

  it("WEB-9.7-INV-03 buildInvoiceLookupPath encodes registration id", () => {
    const registrationId = randomUUID();
    assert.equal(
      buildInvoiceLookupPath(registrationId),
      `/api/finance/invoices/${encodeURIComponent(registrationId)}`
    );
  });
});
