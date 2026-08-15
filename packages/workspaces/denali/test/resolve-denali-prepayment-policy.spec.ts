import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveDenaliPrepaymentPolicy,
  resolveDenaliSuggestedPrepaymentMinor,
} from "../src/bookings/resolve-denali-prepayment-policy.ts";

describe("resolve-denali-prepayment-policy.spec.ts", () => {
  it("resolves enabled percentage policy from canonical pricing", () => {
    const policy = resolveDenaliPrepaymentPolicy({
      pricing: {
        prepaymentEnabled: true,
        prepaymentPercent: 30,
      },
    });
    assert.deepEqual(policy, {
      enabled: true,
      percent: 30,
    });
  });

  it("disables policy when percent is missing or out of range", () => {
    assert.deepEqual(
      resolveDenaliPrepaymentPolicy({
        pricing: { prepaymentEnabled: true },
      }),
      { enabled: false, percent: null }
    );
    assert.deepEqual(
      resolveDenaliPrepaymentPolicy({
        pricing: { prepaymentEnabled: true, prepaymentPercent: 0 },
      }),
      { enabled: false, percent: null }
    );
    assert.deepEqual(
      resolveDenaliPrepaymentPolicy({
        pricing: { prepaymentEnabled: true, prepaymentPercent: 101 },
      }),
      { enabled: false, percent: null }
    );
  });

  it("suggests a prepayment amount from invoice total and caps at remaining balance", () => {
    assert.equal(
      resolveDenaliSuggestedPrepaymentMinor({
        tourCanonicalData: {
          pricing: {
            prepaymentEnabled: true,
            prepaymentPercent: 30,
          },
        },
        invoiceTotalMinor: "1000000",
        balanceDueMinor: "1000000",
      }),
      "300000"
    );

    assert.equal(
      resolveDenaliSuggestedPrepaymentMinor({
        tourCanonicalData: {
          pricing: {
            prepaymentEnabled: true,
            prepaymentPercent: 50,
          },
        },
        invoiceTotalMinor: "1000000",
        balanceDueMinor: "200000",
      }),
      "200000"
    );
  });
});
