import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toUrbanPublicCatalogCard } from "../src/catalog/urban-public-catalog-surface";

const TOUR_ID = "00000000-0000-4000-8000-000000000410";

function publishedCanonical(extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1 as const,
    roots: ["tour"] as const,
    data: {
      tour: {
        title: "Munich summer nights",
        city: "Munich",
        venueName: "Marienplatz",
        startDate: "2026-09-01",
        endDate: "2026-09-02",
        publishStatus: "published",
        catalogSummary: "Munich summer nights on Marienplatz",
        coverImageUrl: "https://cdn.example.com/urban/munich-cover.jpg",
        ...extra,
      },
    },
  };
}

describe("urban-public-catalog-surface", () => {
  it("URB-CAT-01 toUrbanPublicCatalogCard sets Track A presentation fields", () => {
    const card = toUrbanPublicCatalogCard({
      id: TOUR_ID,
      canonical: publishedCanonical(),
    });
    assert.equal(card.id, TOUR_ID);
    assert.equal(card.listSubtitle, "Munich · Marienplatz");
    assert.equal(card.listDescription, "Munich summer nights on Marienplatz");
    assert.equal(card.showListPrice, false);
    assert.equal(card.departureAt, "2026-09-01");
    assert.equal(card.endAt, "2026-09-02");
    assert.equal(card.city, "Munich");
    assert.equal(card.publishStatus, "published");
  });
});
