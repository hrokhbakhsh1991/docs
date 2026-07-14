import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCatalogTourPhotoItems } from "../src/catalog/build-catalog-tour-photo-items";
import { MARKETING_FALLBACK_TOUR_COVER_PATH } from "../src/home/home-marketing-assets";
import type { MarketingCatalogCard } from "../src/catalog/catalog-types";

function tour(overrides: Partial<MarketingCatalogCard> = {}): MarketingCatalogCard {
  return {
    id: "tour-1",
    title: "Alpine day hike",
    coverImageUrl: "https://cdn.example.com/cover.jpg",
    photoUrls: [
      "https://cdn.example.com/photo-2.jpg",
      "https://cdn.example.com/photo-3.jpg",
      "https://cdn.example.com/photo-4.jpg",
    ],
    ...overrides,
  } as MarketingCatalogCard;
}

describe("build-catalog-tour-photo-items.spec.ts — PR-D6b", () => {
  it("maps API photos to alt labels with 1-based index", () => {
    const items = buildCatalogTourPhotoItems(tour(), (index) => `Photo ${index}`);
    assert.equal(items.length, 4);
    assert.equal(items[0]?.src, "https://cdn.example.com/cover.jpg");
    assert.equal(items[0]?.alt, "Photo 1");
    assert.equal(items[1]?.alt, "Photo 2");
  });

  it("PR-D6b-02 pads unreachable smoke URLs with marketing fallbacks", () => {
    const items = buildCatalogTourPhotoItems(
      tour({
        coverImageUrl: "https://cdn.example/cover.jpg",
        photoUrls: ["https://cdn.example/photo-2.jpg"],
      }),
      (index) => `Photo ${index}`
    );
    assert.equal(items.length, 4);
    assert.equal(items[0]?.src, MARKETING_FALLBACK_TOUR_COVER_PATH);
  });
});
