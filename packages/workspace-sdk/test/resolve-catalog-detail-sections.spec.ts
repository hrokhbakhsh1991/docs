import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveCatalogDetailSections,
  UnknownCatalogPresentationPluginError,
} from "../src/catalog/resolve-catalog-detail-sections";

describe("resolveCatalogDetailSections", () => {
  it("enables Denali detail sections", () => {
    assert.deepEqual(resolveCatalogDetailSections("denali"), {
      difficulty: true,
      fitness: true,
      itinerary: true,
      policies: true,
    });
  });

  it("disables Urban-only Denali sections", () => {
    assert.deepEqual(resolveCatalogDetailSections("urban"), {
      difficulty: false,
      fitness: false,
      itinerary: false,
      policies: false,
    });
  });

  it("unknown plugins fail closed", () => {
    assert.throws(
      () => resolveCatalogDetailSections("starter"),
      UnknownCatalogPresentationPluginError
    );
  });
});
