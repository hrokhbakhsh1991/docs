import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toDenaliCatalogCard } from "../src/catalog/denali-catalog-card";
import { isDenaliTourPublished } from "../src/catalog/denali-publish-status";

const TOUR_ID = "00000000-0000-4000-8000-000000000210";

function canonical(publishStatus: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1 as const,
    roots: ["basics"] as const,
    data: {
      title: "North Ridge Trek",
      publishStatus,
      startDateTime: "2026-07-01T08:00:00.000Z",
      endDateTime: "2026-07-03T18:00:00.000Z",
      category: "mountain_day",
      capacityMax: 12,
      program: { shortDescription: "Alpine day hike", difficultyLevel: 6 },
      pricing: { basePricePerPerson: 2500000 },
      photos: [{ url: "https://cdn.example/cover.jpg" }],
      ...extra,
    },
  };
}

describe("denali-catalog-card", () => {
  it("DN-CAT-01 active publishStatus is published", () => {
    assert.equal(isDenaliTourPublished(canonical("active")), true);
  });

  it("DN-CAT-02 draft publishStatus is not published", () => {
    assert.equal(isDenaliTourPublished(canonical("draft")), false);
  });

  it("DN-CAT-03 toDenaliCatalogCard maps egress fields", () => {
    const card = toDenaliCatalogCard({ id: TOUR_ID, canonical: canonical("active") });
    assert.equal(card.id, TOUR_ID);
    assert.equal(card.title, "North Ridge Trek");
    assert.equal(card.shortDescription, "Alpine day hike");
    assert.equal(card.category, "mountain_day");
    assert.equal(card.departureAt, "2026-07-01T08:00:00.000Z");
    assert.equal(card.endAt, "2026-07-03T18:00:00.000Z");
    assert.equal(card.priceAmount, 2500000);
    assert.equal(card.priceCurrency, "IRR");
    assert.equal(card.totalCapacity, 12);
    assert.equal(card.coverImageUrl, "https://cdn.example/cover.jpg");
    assert.equal(card.listSubtitle, "mountain_day");
    assert.equal(card.listDescription, "Alpine day hike");
    assert.equal(card.showListPrice, true);
  });
});
