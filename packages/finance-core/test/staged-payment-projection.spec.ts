import assert from "node:assert/strict";
import test from "node:test";

import { resolveStagedPaymentProjection } from "../src/domain/staged-payment-projection";

const invoice = { invoiceTotalMinor: "1000000", balanceDueMinor: "1000000" };

test("staged payment projection keeps full balance and exposes first stage", () => {
  assert.deepEqual(
    resolveStagedPaymentProjection({
      ...invoice,
      paidAmountMinor: "0",
      plan: { enabled: true, percent: 30 },
    }),
    { initialPaymentDueMinor: "300000", amountDueNowMinor: "300000" }
  );
});

test("after first capture the next stage is the remaining balance", () => {
  assert.deepEqual(
    resolveStagedPaymentProjection({
      invoiceTotalMinor: "1000000",
      paidAmountMinor: "300000",
      balanceDueMinor: "700000",
      plan: { enabled: true, percent: 30 },
    }),
    { initialPaymentDueMinor: "300000", amountDueNowMinor: "700000" }
  );
});

test("disabled and invalid policies fail closed to the regular balance", () => {
  for (const plan of [
    null,
    { enabled: false, percent: 30 },
    { enabled: true, percent: 0 },
    { enabled: true, percent: 101 },
  ]) {
    assert.deepEqual(resolveStagedPaymentProjection({ ...invoice, paidAmountMinor: "0", plan }), {
      initialPaymentDueMinor: "0",
      amountDueNowMinor: "1000000",
    });
  }
});

test("100 percent is capped by the current balance", () => {
  assert.deepEqual(
    resolveStagedPaymentProjection({
      invoiceTotalMinor: "1000000",
      paidAmountMinor: "900000",
      balanceDueMinor: "100000",
      plan: { enabled: true, percent: 100 },
    }),
    { initialPaymentDueMinor: "100000", amountDueNowMinor: "100000" }
  );
});
