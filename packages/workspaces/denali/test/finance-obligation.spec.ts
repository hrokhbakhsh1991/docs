/**
 * FC-2 — Denali registration obligation pure resolver.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliRegistrationObligationMinor } from "../src/finance/resolve-denali-registration-obligation.ts";

describe("finance-obligation.spec.ts — FC-2 Denali", () => {
  it("DEN-FC2-01 multiplies basePricePerPerson × partySize for offline_receipt", () => {
    const resolved = resolveDenaliRegistrationObligationMinor({
      tourCanonical: {
        pricing: {
          basePricePerPerson: 2_500_000,
          paymentMode: "offline_receipt",
        },
      },
      partySize: 2,
    });
    assert.ok(resolved !== null);
    assert.equal(resolved.obligationMinor, "5000000");
    assert.equal(resolved.currency, "IRR");
    assert.equal(resolved.source, "tour_canonical");
  });

  it("DEN-FC2-02 returns null when paymentMode is not offline_receipt", () => {
    const resolved = resolveDenaliRegistrationObligationMinor({
      tourCanonical: {
        pricing: {
          basePricePerPerson: 2_500_000,
          paymentMode: "gateway",
        },
      },
      partySize: 1,
    });
    assert.equal(resolved, null);
  });

  it("DEN-FC2-03 returns null when base price missing", () => {
    const resolved = resolveDenaliRegistrationObligationMinor({
      tourCanonical: { pricing: { paymentMode: "offline_receipt" } },
      partySize: 1,
    });
    assert.equal(resolved, null);
  });
});
