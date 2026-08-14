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

  it("PR15-E — wizard envelope data.pricing resolves (live Prisma shape)", () => {
    const resolved = resolveDenaliRegistrationObligationMinor({
      tourCanonical: {
        data: {
          pricing: {
            basePricePerPerson: 2_500_000,
            paymentMode: "offline_receipt",
          },
        },
        roots: {},
        schemaVersion: 1,
      },
      partySize: 1,
    });
    assert.ok(resolved !== null);
    assert.equal(resolved.obligationMinor, "2500000");
    assert.equal(resolved.currency, "IRR");
    assert.equal(resolved.source, "tour_canonical");
  });

  it("PR15-E — missing pricing stays null (unknown; never zero)", () => {
    assert.equal(
      resolveDenaliRegistrationObligationMinor({
        tourCanonical: {
          data: { title: "No price tour", pricing: { paymentMode: "offline_receipt" } },
          roots: {},
          schemaVersion: 1,
        },
        partySize: 1,
      }),
      null
    );
    assert.equal(
      resolveDenaliRegistrationObligationMinor({
        tourCanonical: { data: { title: "No pricing object" }, roots: {}, schemaVersion: 1 },
        partySize: 1,
      }),
      null
    );
  });

  it("PR15-E — malformed envelope yields null (no guess)", () => {
    assert.equal(
      resolveDenaliRegistrationObligationMinor({
        tourCanonical: { data: null, roots: {}, schemaVersion: 1 },
        partySize: 1,
      }),
      null
    );
    assert.equal(
      resolveDenaliRegistrationObligationMinor({
        tourCanonical: { data: "not-an-object", roots: {}, schemaVersion: 1 },
        partySize: 1,
      }),
      null
    );
    assert.equal(
      resolveDenaliRegistrationObligationMinor({
        tourCanonical: null,
        partySize: 1,
      }),
      null
    );
  });

  it("PR15-E — flat and wrapped same pricing ⇒ same obligationMinor", () => {
    const flat = resolveDenaliRegistrationObligationMinor({
      tourCanonical: {
        pricing: { basePricePerPerson: 1_000_000, paymentMode: "offline_receipt" },
      },
      partySize: 3,
    });
    const wrapped = resolveDenaliRegistrationObligationMinor({
      tourCanonical: {
        data: {
          pricing: { basePricePerPerson: 1_000_000, paymentMode: "offline_receipt" },
        },
        roots: {},
        schemaVersion: 1,
      },
      partySize: 3,
    });
    assert.ok(flat !== null && wrapped !== null);
    assert.equal(flat.obligationMinor, wrapped.obligationMinor);
    assert.equal(flat.currency, wrapped.currency);
  });
});
