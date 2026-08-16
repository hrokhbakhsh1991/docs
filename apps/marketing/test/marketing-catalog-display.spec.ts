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
  it("MKT-01 urban subtitle uses normalized listSubtitle", () => {
    assert.equal(
      formatCatalogCardSubtitle({ id: "1", listSubtitle: "Tehran · Azadi" }),
      "Tehran · Azadi"
    );
  });

  it("MKT-02 denali subtitle uses normalized listSubtitle", () => {
    assert.equal(formatCatalogCardSubtitle({ id: "1", listSubtitle: "Trek" }), "Trek");
  });

  it("MKT-02b legacy urban subtitle falls back to city and venue", () => {
    assert.equal(
      formatCatalogCardSubtitle({ id: "1", city: "Tehran", venueName: "Azadi" }),
      "Tehran · Azadi"
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

  it("MKT-03b fa dates use Persian calendar labels", () => {
    const label = formatCatalogCardDates(
      {
        id: "1",
        departureAt: "2026-07-01T08:00:00.000Z",
        endAt: "2026-07-03T18:00:00.000Z",
      },
      "fa-IR",
      "تاریخ اعلام می‌شود"
    );
    assert.doesNotMatch(label, /Jul/);
    assert.match(label, /[\u06F0-\u06F9]/);
  });

  it("MKT-04 urban cards hide price row via showListPrice", () => {
    assert.equal(shouldShowCatalogPrice({ showListPrice: false, priceAmount: 1000 }), false);
    assert.equal(shouldShowCatalogPrice({ showListPrice: true, priceAmount: 1000 }), true);
  });

  it("MKT-05 formatCatalogPrice handles null", () => {
    assert.equal(formatCatalogPrice(null, "IRR", "en-US", "Price on request"), "Price on request");
  });

  it("MKT-CURR-01 IRR catalog price uses toman label without ×10", () => {
    assert.equal(formatCatalogPrice(1200, "IRR", "en-US", "Price on request"), "1,200 toman");
    assert.equal(formatCatalogPrice(2_500_000, "IRR", "en-US", "Price on request"), "2,500,000 toman");
    const faDigits = new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: 0,
      numberingSystem: "arabext",
    }).format(1200);
    assert.equal(formatCatalogPrice(1200, "IRR", "fa-IR", "قیمت پس از استعلام"), `${faDigits} تومان`);
    assert.equal(formatCatalogPrice(1200, "IRR", "en-US", "Price on request").includes("12,000"), false);
    const usd = formatCatalogPrice(1200, "USD", "en-US", "Price on request");
    assert.match(usd, /1,200/);
    assert.equal(usd.includes("toman"), false);
  });
});

describe("resolvePublicBrandingHost", () => {
  it("MKT-06 strips shop prefix", () => {
    assert.equal(resolvePublicBrandingHost("shop.operator.localhost:3002"), "operator.localhost");
  });
});
