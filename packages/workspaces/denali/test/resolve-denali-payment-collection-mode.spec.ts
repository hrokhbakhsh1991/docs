import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliPaymentCollectionMode } from "../src/finance/resolve-denali-payment-collection-mode.ts";
import { resolveDenaliRegistrationObligationMinor } from "../src/finance/resolve-denali-registration-obligation.ts";

describe("resolveDenaliPaymentCollectionMode", () => {
  it("defaults to offline when missing", () => {
    assert.equal(resolveDenaliPaymentCollectionMode({ data: { title: "T" } }), "offline");
    assert.equal(resolveDenaliPaymentCollectionMode(null), "offline");
  });

  it("reads free from pricing.paymentCollection", () => {
    assert.equal(
      resolveDenaliPaymentCollectionMode({
        data: { pricing: { paymentCollection: "free" } },
      }),
      "free"
    );
    assert.equal(
      resolveDenaliPaymentCollectionMode({
        pricing: { paymentCollection: "FREE" },
      }),
      "free"
    );
  });
});

describe("resolveDenaliRegistrationObligationMinor — free collection", () => {
  it("returns zero obligation when paymentCollection is free", () => {
    const resolved = resolveDenaliRegistrationObligationMinor({
      tourCanonical: {
        data: {
          pricing: {
            paymentCollection: "free",
            paymentMode: "offline_receipt",
            basePricePerPerson: 2_500_000,
          },
        },
      },
      partySize: 2,
    });
    assert.ok(resolved !== null);
    assert.equal(resolved.obligationMinor, "0");
    assert.equal(resolved.currency, "IRR");
  });
});
