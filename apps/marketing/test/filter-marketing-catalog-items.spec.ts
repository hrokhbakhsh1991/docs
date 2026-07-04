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
    },
    {
      id: "2",
      title: "Forest Walk",
      category: "Nature",
      difficultyLevel: 2,
      fitnessLevel: "low",
      spotsRemaining: 0,
      shortDescription: "Easy woodland trail",
    },
    {
      id: "3",
      title: "Damavand Summit",
      category: "Peak",
      difficultyLevel: 5,
      fitnessLevel: "medium",
      spotsRemaining: 12,
      shortDescription: "Multi-day summit push",
    },
  ];

  it("filters by exact category match", () => {
    assert.deepEqual(
      filterMarketingCatalogItems(items, { category: "Peak" }).map((item) => item.id),
      ["1", "3"]
    );
  });

  it("filters by denali category family", () => {
    assert.deepEqual(
      filterMarketingCatalogItems(
        [
          { id: "1", title: "Alpine", category: "mountain_multi" },
          { id: "2", title: "Woods", category: "nature_day" },
        ],
        { category: "mountain" }
      ).map((item) => item.id),
      ["1"]
    );
  });

  it("filters by case-insensitive q against title and category", () => {
    assert.deepEqual(
      filterMarketingCatalogItems(items, { q: "damavand" }).map((item) => item.id),
      ["3"]
    );
    assert.deepEqual(
      filterMarketingCatalogItems(items, { q: "peak" }).map((item) => item.id),
      ["1", "3"]
    );
  });

  it("filters by description text in q", () => {
    assert.deepEqual(
      filterMarketingCatalogItems(items, { q: "woodland" }).map((item) => item.id),
      ["2"]
    );
  });

  it("filters by difficulty and fitness", () => {
    assert.deepEqual(
      filterMarketingCatalogItems(items, { difficulty: 4 }).map((item) => item.id),
      ["1"]
    );
    assert.deepEqual(
      filterMarketingCatalogItems(items, { fitness: "low" }).map((item) => item.id),
      ["2"]
    );
  });

  it("filters availability=open", () => {
    assert.deepEqual(
      filterMarketingCatalogItems(items, { availability: "open" }).map((item) => item.id),
      ["1", "3"]
    );
  });

  it("applies category then q", () => {
    assert.deepEqual(
      filterMarketingCatalogItems(items, { category: "Peak", q: "north" }).map((item) => item.id),
      ["1"]
    );
  });

  it("returns all items when filters empty", () => {
    assert.equal(filterMarketingCatalogItems(items, {}).length, 3);
  });
});
