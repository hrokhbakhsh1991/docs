import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveCatalogPriceDisplay,
  UnknownCatalogPresentationPluginError,
} from "../src/catalog/resolve-catalog-price-display";

describe("resolveCatalogPriceDisplay", () => {
  it("returns toman policy for Denali manifest row", () => {
    assert.deepEqual(resolveCatalogPriceDisplay("denali"), { irrDisplayUnit: "toman" });
  });

  it("returns null for catalog workspaces without priceDisplay manifest block", () => {
    assert.equal(resolveCatalogPriceDisplay("urban"), null);
    assert.equal(resolveCatalogPriceDisplay("harbor"), null);
    assert.equal(resolveCatalogPriceDisplay("guest-club"), null);
  });

  it("unknown plugins fail closed", () => {
    assert.throws(
      () => resolveCatalogPriceDisplay("starter"),
      UnknownCatalogPresentationPluginError
    );
  });
});
