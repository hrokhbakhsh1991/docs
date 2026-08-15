/**
 * PR20-D — remaining-based manual debt gate.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertManualPaymentDebtAllowed,
  isManualPaymentAmountOverRemaining,
} from "../src/domain/manual-payment-debt-policy.ts";

describe("manual-payment-debt-policy (PR20-D)", () => {
  it("allows first debt when remaining > 0 and no statuses", () => {
    assert.doesNotThrow(() =>
      assertManualPaymentDebtAllowed({ statuses: [], balanceDueMinor: "2500000" })
    );
  });

  it("allows additional debt after Paid while remaining > 0 (partial collection)", () => {
    assert.doesNotThrow(() =>
      assertManualPaymentDebtAllowed({
        statuses: ["Paid"],
        balanceDueMinor: "1000000",
      })
    );
  });

  it("allows additional debt after Cancelled while remaining > 0 (PR23-A.2)", () => {
    assert.doesNotThrow(() =>
      assertManualPaymentDebtAllowed({
        statuses: ["Cancelled"],
        balanceDueMinor: "1000000",
      })
    );
  });

  it("rejects when Pending already exists", () => {
    assert.throws(
      () =>
        assertManualPaymentDebtAllowed({
          statuses: ["Paid", "Pending"],
          balanceDueMinor: "1000000",
        }),
      /pending payment already exists/
    );
  });

  it("rejects after settlement (Paid + remaining 0)", () => {
    assert.throws(
      () =>
        assertManualPaymentDebtAllowed({
          statuses: ["Paid"],
          balanceDueMinor: "0",
        }),
      /successful payment; additional manual debt is not allowed/
    );
  });

  it("rejects when remaining 0 without Paid and invoice total known", () => {
    assert.throws(
      () =>
        assertManualPaymentDebtAllowed({
          statuses: [],
          balanceDueMinor: "0",
          invoiceTotalMinor: "2500000",
        }),
      /no remaining balance/
    );
  });

  it("allows bootstrap first debt when remaining and invoice total are both 0", () => {
    assert.doesNotThrow(() =>
      assertManualPaymentDebtAllowed({
        statuses: [],
        balanceDueMinor: "0",
        invoiceTotalMinor: "0",
      })
    );
  });

  it("rejects when remaining 0 without Paid (legacy callers omit invoice total)", () => {
    assert.throws(
      () =>
        assertManualPaymentDebtAllowed({
          statuses: [],
          balanceDueMinor: "0",
        }),
      /no remaining balance/
    );
  });

  it("detects amount over remaining + tolerance", () => {
    assert.equal(
      isManualPaymentAmountOverRemaining({
        amountMinor: "1000001",
        balanceDueMinor: "1000000",
        toleranceMinor: "0",
      }),
      true
    );
    assert.equal(
      isManualPaymentAmountOverRemaining({
        amountMinor: "1000000",
        balanceDueMinor: "1000000",
        toleranceMinor: "0",
      }),
      false
    );
  });
});
