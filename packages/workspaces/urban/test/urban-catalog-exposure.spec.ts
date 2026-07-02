import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toUrbanPublicCatalogCard } from "../src/catalog/urban-public-catalog-surface";
import {
  applyUrbanCatalogCardExposure,
  URBAN_CATALOG_CARD_EXPOSURE_BINDINGS,
} from "../src/catalog/urban-catalog-exposure-bindings";

describe("applyUrbanCatalogCardExposure", () => {
  const tour = {
    id: "tour-1",
    canonical: {
      schemaVersion: 1,
      roots: ["tour"],
      data: {
        tour: {
          title: "City walk",
          city: "Tehran",
          venueName: "Azadi Tower",
          startDate: "2026-08-01",
          endDate: "2026-08-02",
          catalogSummary: "Evening stroll",
          coverImageUrl: "https://cdn.example/cover.jpg",
          publishStatus: "published",
        },
      },
    },
  };

  it("redacts hidden fields from urban catalog cards", () => {
    const card = toUrbanPublicCatalogCard(tour);
    const redacted = applyUrbanCatalogCardExposure(
      card,
      new Set(["tour.title", "tour.city", "tour.startDate"]),
    );

    assert.equal(redacted.title, "City walk");
    assert.equal(redacted.city, "Tehran");
    assert.equal(redacted.venueName, null);
    assert.equal(redacted.startDate, "2026-08-01");
    assert.equal(redacted.endDate, null);
    assert.equal(redacted.coverImageUrl, null);
    assert.equal(redacted.listSubtitle, "Tehran");
  });

  it("recomputes listSubtitle after venue redaction", () => {
    const card = toUrbanPublicCatalogCard(tour);
    const redacted = applyUrbanCatalogCardExposure(
      card,
      new Set(["tour.title", "tour.city", "tour.startDate", "tour.endDate"]),
    );
    assert.equal(redacted.listSubtitle, "Tehran");
  });

  it("uses fallback title when tour.title is hidden", () => {
    const card = toUrbanPublicCatalogCard(tour);
    const redacted = applyUrbanCatalogCardExposure(card, new Set(["tour.city"]));
    assert.equal(redacted.title, "Untitled tour");
  });

  it("binds catalog-relevant registry field ids", () => {
    const bindingFieldIds = URBAN_CATALOG_CARD_EXPOSURE_BINDINGS.map((entry) => entry.fieldId);
    assert.ok(bindingFieldIds.includes("tour.city"));
    assert.ok(bindingFieldIds.includes("tour.coverImageUrl"));
    assert.ok(!bindingFieldIds.includes("tour.publishStatus"));
  });
});
