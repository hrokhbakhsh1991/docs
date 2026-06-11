/**
 * Denali tour list category filter helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  matchesTourCategoryFilter,
  TOUR_CATEGORY_FILTER_ALL,
} from "../src/features/tours/tour-list-category-logic";

describe("tour-list-category-logic.spec.ts", () => {
  it("matches all categories when filter is all", () => {
    assert.equal(matchesTourCategoryFilter("mountain_day", TOUR_CATEGORY_FILTER_ALL), true);
    assert.equal(matchesTourCategoryFilter(null, TOUR_CATEGORY_FILTER_ALL), true);
  });

  it("matches exact denali tour kind slug", () => {
    assert.equal(matchesTourCategoryFilter("desert_multi", "desert_multi"), true);
    assert.equal(matchesTourCategoryFilter("nature_day", "desert_multi"), false);
    assert.equal(matchesTourCategoryFilter(null, "mountain_day"), false);
  });
});
