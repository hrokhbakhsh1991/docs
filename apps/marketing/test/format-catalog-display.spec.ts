import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCatalogCardDescription,
  formatCatalogCardSubtitle,
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

  it("respects showListPrice false (Urban egress default)", () => {
    assert.equal(
      shouldShowCatalogPrice({
        showListPrice: false,
        priceAmount: 1200,
      }),
      false,
    );
    assert.equal(
      shouldShowCatalogPrice({
        priceAmount: 1200,
      }),
      true,
    );
  });
});
