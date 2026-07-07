import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveCatalogFilterOptions } from "../src/catalog/derive-catalog-filter-options";

describe("derive-catalog-filter-options.spec.ts — PR-21.1 / PR-23", () => {
  it("denali uses admin-aligned fixed filter options", () => {
    const options = deriveCatalogFilterOptions({
      pluginId: "denali",
      items: [{ id: "1", title: "A", category: "nature_day", difficultyLevel: 2 }],
      activeFilters: {
        category: "mountain",
        difficulty: 5,
        fitness: "high",
      },
    });

    assert.deepEqual(options.categories, ["mountain", "nature"]);
    assert.equal(options.difficulties.length, 19);
    assert.deepEqual(options.fitnessLevels, ["low", "medium", "high"]);
  });

  it("urban derives options from batch", () => {
    const options = deriveCatalogFilterOptions({
      pluginId: "urban",
      items: [{ id: "1", title: "A", category: "concert", difficultyLevel: 2 }],
      activeFilters: { category: "theater" },
    });

    assert.deepEqual(options.categories.sort(), ["concert", "theater"]);
  });
});
