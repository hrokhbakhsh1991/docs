import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCatalogCardDates,
  formatCatalogCardSubtitle,
  formatCatalogPrice,
  shouldShowCatalogPrice,
} from "../src/catalog/format-catalog-display";
import { resolvePublicBrandingHost } from "@app-tour/guest-surface-host";

describe("marketing catalog display", () => {
  it("MKT-01 urban subtitle uses city and venue", () => {
    assert.equal(
      formatCatalogCardSubtitle({ id: "1", city: "Tehran", venueName: "Azadi" }, "urban"),
      "Tehran · Azadi"
    );
  });

  it("MKT-02 denali subtitle uses category", () => {
    assert.equal(
      formatCatalogCardSubtitle({ id: "1", category: "Trek" }, "denali"),
      "Trek"
    );
  });

  it("MKT-03 urban dates fall back to startDate/endDate", () => {
    const label = formatCatalogCardDates(
      {
        id: "1",
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-05T00:00:00.000Z",
      },
      "en-US",
      "Dates TBA"
    );
    assert.match(label, /Jul/);
  });

  it("MKT-04 urban cards hide price row", () => {
    assert.equal(shouldShowCatalogPrice("urban", 1000), false);
    assert.equal(shouldShowCatalogPrice("denali", 1000), true);
  });

  it("MKT-05 formatCatalogPrice handles null", () => {
    assert.equal(formatCatalogPrice(null, "IRR", "en-US", "Price on request"), "Price on request");
  });
});

describe("resolvePublicBrandingHost", () => {
  it("MKT-06 strips shop prefix", () => {
    assert.equal(resolvePublicBrandingHost("shop.operator.localhost:3002"), "operator.localhost");
  });
});
