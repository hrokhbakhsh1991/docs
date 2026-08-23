import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  formatCatalogCardDescription,
  formatCatalogCardSubtitle,
  formatCatalogPrice,
  shouldShowCatalogPrice,
} from "../src/catalog/format-catalog-display";

describe("format-catalog-display", () => {
  it("prefers Track A listSubtitle over legacy city/venue", () => {
    const subtitle = formatCatalogCardSubtitle({
      id: "t1",
      title: "Tour",
      listSubtitle: "Tehran · Azadi",
      city: "Berlin",
      venueName: "Alexanderplatz",
    });
    assert.equal(subtitle, "Tehran · Azadi");
  });

  it("falls back to legacy city and venue when listSubtitle absent", () => {
    const subtitle = formatCatalogCardSubtitle({
      id: "t1",
      title: "Tour",
      city: "Berlin",
      venueName: "Alexanderplatz",
    });
    assert.equal(subtitle, "Berlin · Alexanderplatz");
  });

  it("prefers listDescription for body copy", () => {
    const description = formatCatalogCardDescription({
      id: "t1",
      title: "Tour",
      listDescription: "Normalized summary",
      shortDescription: "Legacy short",
      catalogSummary: "Urban summary",
    });
    assert.equal(description, "Normalized summary");
  });

  it("respects showListPrice false from presentation egress", () => {
    assert.equal(
      shouldShowCatalogPrice({
        showListPrice: false,
        priceAmount: 1200,
      }),
      false
    );
    assert.equal(
      shouldShowCatalogPrice({
        priceAmount: 1200,
      }),
      true
    );
  });

  it("uses workspace price-display policy instead of plugin id for IRR toman labels", () => {
    assert.equal(formatCatalogPrice(1200, "IRR", "en-US", "Price on request", null), "IRR 1,200");
    assert.equal(
      formatCatalogPrice(1200, "IRR", "en-US", "Price on request", {
        irrDisplayUnit: "toman",
      }),
      "1,200 toman"
    );
  });

  it("does not invent IRR when catalog price currency is absent", () => {
    assert.equal(
      formatCatalogPrice(1200, "", "en-US", "Price on request", null),
      "Price on request"
    );
    assert.equal(
      formatCatalogPrice(1200, undefined, "fa-IR", "قیمت پس از استعلام", {
        irrDisplayUnit: "toman",
      }),
      "قیمت پس از استعلام"
    );
  });

  it("keeps marketing catalog display contracts workspace-generic", () => {
    const catalogTypes = readFileSync(
      new URL("../src/catalog/catalog-types.ts", import.meta.url),
      "utf8"
    );
    const displaySource = readFileSync(
      new URL("../src/catalog/format-catalog-display.ts", import.meta.url),
      "utf8"
    );
    const metaLineSource = readFileSync(
      new URL("../src/catalog/build-catalog-tour-meta-line.ts", import.meta.url),
      "utf8"
    );

    assert.equal(catalogTypes.includes("UrbanCatalogCardExtensions"), false);
    assert.equal(displaySource.includes("Denali departure/end"), false);
    assert.equal(displaySource.includes("Urban start/end"), false);
    assert.equal(displaySource.includes("urbanLine"), false);
    assert.equal(metaLineSource.includes("Localized Denali category"), false);
  });
});
