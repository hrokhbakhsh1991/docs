import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sortMarketingCatalogItems } from "../src/catalog/sort-marketing-catalog-items";

describe("sort-marketing-catalog-items.spec.ts — PR-21", () => {
  const items = [
    {
      id: "a",
      title: "Late",
      departureAt: "2026-08-01T08:00:00.000Z",
      priceAmount: 500,
      difficultyLevel: 3,
    },
    {
      id: "b",
      title: "Early",
      departureAt: "2026-07-01T08:00:00.000Z",
      priceAmount: 200,
      difficultyLevel: 1,
    },
    {
      id: "c",
      title: "Mid",
      departureAt: "2026-07-15T08:00:00.000Z",
      priceAmount: 800,
      difficultyLevel: 5,
    },
  ];

  it("preserves API order for newest", () => {
    assert.deepEqual(
      sortMarketingCatalogItems(items, "newest").map((item) => item.id),
      ["a", "b", "c"]
    );
  });

  it("sorts by departure ascending", () => {
    assert.deepEqual(
      sortMarketingCatalogItems(items, "departure_asc").map((item) => item.id),
      ["b", "c", "a"]
    );
  });

  it("sorts by price descending", () => {
    assert.deepEqual(
      sortMarketingCatalogItems(items, "price_desc").map((item) => item.id),
      ["c", "a", "b"]
    );
  });

  it("sorts by difficulty ascending", () => {
    assert.deepEqual(
      sortMarketingCatalogItems(items, "difficulty_asc").map((item) => item.id),
      ["b", "a", "c"]
    );
  });
});
