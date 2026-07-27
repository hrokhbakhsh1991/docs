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

  it("DEN-FC2-04 currency override uppercases and replaces default IRR", () => {
    const resolved = resolveDenaliRegistrationObligationMinor({
      tourCanonical: {
        pricing: { basePricePerPerson: 1000, paymentMode: "offline_receipt" },
      },
      partySize: 3,
      currency: "usd",
    });
    assert.ok(resolved !== null);
    assert.equal(resolved.currency, "USD");
    assert.equal(resolved.obligationMinor, "3000");
  });

  it("DEN-FC2-05 partySize < 1 or non-finite yields null", () => {
    const canonical = {
      pricing: { basePricePerPerson: 1000, paymentMode: "offline_receipt" },
    };
    assert.equal(
      resolveDenaliRegistrationObligationMinor({ tourCanonical: canonical, partySize: 0 }),
      null
    );
    assert.equal(
      resolveDenaliRegistrationObligationMinor({ tourCanonical: canonical, partySize: -1 }),
      null
    );
    assert.equal(
      resolveDenaliRegistrationObligationMinor({ tourCanonical: canonical, partySize: Number.NaN }),
      null
    );
  });

  it("DEN-FC2-06 missing paymentMode still resolves when price present (offline default path)", () => {
    const resolved = resolveDenaliRegistrationObligationMinor({
      tourCanonical: { pricing: { basePricePerPerson: 250 } },
      partySize: 2,
    });
    assert.ok(resolved !== null);
    assert.equal(resolved.obligationMinor, "500");
  });
});
