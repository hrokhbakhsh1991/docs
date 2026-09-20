/**
 * HOME-UNIT-07 — client-side catalog list filters (PR-7 / PR-21).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterMarketingCatalogItems } from "../src/catalog/filter-marketing-catalog-items";

describe("filter-marketing-catalog-items.spec.ts — HOME-UNIT-07", () => {
  const items = [
    {
      id: "1",
      title: "North Ridge Trek",
      category: "Peak",
      difficultyLevel: 4,
      fitnessLevel: "high",
      spotsRemaining: 3,
      shortDescription: "Alpine ridge day hike",
      departureAt: "2026-08-01T08:00:00.000Z",
      endAt: "2026-08-03T08:00:00.000Z",
      priceAmount: 3000000,
    },
    {
      id: "2",
      title: "Forest Walk",
      category: "Nature",
      difficultyLevel: 2,
      fitnessLevel: "low",
      spotsRemaining: 0,
      shortDescription: "Easy woodland trail",
      departureAt: "2026-08-01T08:00:00.000Z",
      endAt: "2026-08-01T18:00:00.000Z",
      priceAmount: 800000,
    },
    {
      id: "3",
      title: "Damavand Summit",
      category: "Peak",
      difficultyLevel: 5,
      fitnessLevel: "medium",
      spotsRemaining: 12,
      shortDescription: "Multi-day summit push",
      departureAt: "2026-08-01T08:00:00.000Z",
      endAt: "2026-08-06T08:00:00.000Z",
      priceAmount: 7000000,
    },
  ];

  it("filters by exact category match", async () => {
    assert.deepEqual(
      (await filterMarketingCatalogItems(items, { category: "Peak" })).map((item) => item.id),
      ["1", "3"]
    );
  });

  it("filters by denali category family", async () => {
    assert.deepEqual(
      (await filterMarketingCatalogItems(
        [
          { id: "1", title: "Alpine", category: "mountain_multi" },
          { id: "2", title: "Woods", category: "nature_day" },
        ],
        { category: "mountain" },
        "denali"
      )).map((item) => item.id),
      ["1"]
    );
  });

  it("filters by case-insensitive q against title and category", async () => {
    assert.deepEqual(
      (await filterMarketingCatalogItems(items, { q: "damavand" })).map((item) => item.id),
      ["3"]
    );
    assert.deepEqual(
      (await filterMarketingCatalogItems(items, { q: "peak" })).map((item) => item.id),
      ["1", "3"]
    );
  });

  it("filters by description text in q", async () => {
    assert.deepEqual(
      (await filterMarketingCatalogItems(items, { q: "woodland" })).map((item) => item.id),
      ["2"]
    );
  });

  it("filters by difficulty and fitness", async () => {
    assert.deepEqual(
      (await filterMarketingCatalogItems(items, { difficulty: 4 })).map((item) => item.id),
      ["1"]
    );
    assert.deepEqual(
      (await filterMarketingCatalogItems(items, { fitness: "low" })).map((item) => item.id),
      ["2"]
    );
  });

  it("filters availability=open", async () => {
    assert.deepEqual(
      (await filterMarketingCatalogItems(items, { availability: "open" })).map((item) => item.id),
      ["1", "3"]
    );
  });

  it("filters by duration and price ranges", async () => {
    assert.deepEqual(
      (
        await filterMarketingCatalogItems(items, {
          minDuration: 2,
          maxDuration: 3,
          minPrice: 2000000,
          maxPrice: 5000000,
        })
      ).map((item) => item.id),
      ["1"]
    );
  });

  it("applies category then q", async () => {
    assert.deepEqual(
      (await filterMarketingCatalogItems(items, { category: "Peak", q: "north" })).map((item) => item.id),
      ["1"]
    );
  });

  it("returns all items when filters empty", async () => {
    assert.equal((await filterMarketingCatalogItems(items, {})).length, 3);
  });

  it("blocks known staging/test records from public catalog egress", async () => {
    const result = await filterMarketingCatalogItems(
      [
        ...items,
        { id: "test-1", title: "hgjghjfghj" },
        { id: "test-2", title: "تست اعلان تلگرام استیجینگ" },
        { id: "test-3", title: "سناریوی تست تور پولی" },
      ],
      {}
    );
    assert.deepEqual(result.map((item) => item.id), ["1", "2", "3"]);
  });
});
