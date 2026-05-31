import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDenormalizedTourCommercialColumns,
  resolveCatalogCurrencyForDenormalization,
} from "../utils/commercial-fields";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("should resolve tenant operating currency when cost_context currency is omitted", async () => {
  const tour = {
    costContext: { totalCost: "1200000", requiresPayment: true },
    currencyCode: null as string | null,
    listPriceMinor: null as string | null,
  };

  await applyDenormalizedTourCommercialColumns(tour, TENANT_ID, async () => "IRR");

  assert.equal(tour.currencyCode, "IRR");
  assert.equal(tour.listPriceMinor, "1200000");
});

test("resolveCatalogCurrencyForDenormalization prefers explicit cost_context currency", async () => {
  const currency = await resolveCatalogCurrencyForDenormalization(
    { currency: "EUR", totalCost: "10" },
    {
      tenantId: TENANT_ID,
      resolveOperatingCurrencyCode: async () => "IRR",
    },
  );
  assert.equal(currency, "EUR");
});

test("resolveCatalogCurrencyForDenormalization uses prior tour currency before operating lookup", async () => {
  let operatingLookupCount = 0;
  const currency = await resolveCatalogCurrencyForDenormalization(
    { totalCost: "10" },
    {
      tenantId: TENANT_ID,
      tourCurrencyCode: "KWD",
      resolveOperatingCurrencyCode: async () => {
        operatingLookupCount += 1;
        return "IRR";
      },
    },
  );
  assert.equal(currency, "KWD");
  assert.equal(operatingLookupCount, 0);
});
