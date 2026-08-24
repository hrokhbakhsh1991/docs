/**
 * DP1 scenario index — documents 20-scenario automated coverage entrypoints.
 * @see docs/dev/dp-1-execution-plan.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const SCENARIO_FILES: Readonly<Record<string, string>> = {
  S1: "booking-approve-payment-hold.spec.ts",
  S2: "payment-hold-financial.spec.ts",
  S3: "payment-hold-expiry-race.spec.ts",
  S3b: "payment-hold-expiry-race.spec.ts",
  S4: "payment-hold-expiry.spec.ts",
  S5: "payment-hold-expiry.spec.ts",
  S6: "payment-hold-waitlist.spec.ts",
  S7: "payment-hold-expiry.spec.ts",
  S8: "payment-hold-expiry-race.spec.ts",
  S9: "payment-hold-expiry-idempotency.spec.ts",
  S10: "payment-hold-financial.spec.ts",
  S10b: "payment-hold-financial.spec.ts",
  S11: "payment-hold-extend.spec.ts",
  S13: "payment-hold-expiry.spec.ts",
  S14: "payment-hold-extend.spec.ts",
  S15: "portal-payment-deadline.spec.ts",
  S16: "portal-payment-deadline.spec.ts",
  S17: "payment-hold-api-contract.spec.ts",
  S18: "payment-hold-scheduler.spec.ts",
  S19: "payment-hold-scheduler.spec.ts",
  S20: "payment-hold-expiry-idempotency.spec.ts",
};

describe("DP1-L integration scenario map", () => {
  it("maps all in-scope scenarios to spec files (S12 excluded — DP-4)", () => {
    const ids = Object.keys(SCENARIO_FILES);
    assert.ok(!ids.includes("S12"));
    assert.equal(new Set(ids).size, ids.length);
    for (const file of new Set(Object.values(SCENARIO_FILES))) {
      assert.ok(file.endsWith(".spec.ts"));
    }
  });
});
