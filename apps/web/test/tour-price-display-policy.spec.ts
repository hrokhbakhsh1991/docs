import assert from "node:assert/strict";
import test from "node:test";

import { resolveTourPriceDisplayPolicy } from "@/features/tours/resolve-tour-price-display-policy";

test("resolveTourPriceDisplayPolicy binds Denali manifest priceDisplay", () => {
  assert.deepEqual(resolveTourPriceDisplayPolicy("denali"), { irrDisplayUnit: "toman" });
});

test("resolveTourPriceDisplayPolicy returns null for catalog workspaces without priceDisplay", () => {
  assert.equal(resolveTourPriceDisplayPolicy("urban"), null);
  assert.equal(resolveTourPriceDisplayPolicy("harbor"), null);
});

test("resolveTourPriceDisplayPolicy is neutral for non-catalog operator plugins", () => {
  assert.equal(resolveTourPriceDisplayPolicy("starter"), null);
  assert.equal(resolveTourPriceDisplayPolicy("alpine"), null);
});
