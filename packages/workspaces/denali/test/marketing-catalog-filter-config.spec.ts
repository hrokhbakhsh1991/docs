import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DENALI_MARKETING_DIFFICULTY_LEVELS,
  matchesDenaliMarketingCategoryFilter,
} from "@app-tour/workspace-denali/marketing";

describe("denali marketing catalog-filter-config — PR-23", () => {
  it("matches category family prefixes from admin wizard", () => {
    assert.equal(matchesDenaliMarketingCategoryFilter("mountain_multi", "mountain"), true);
    assert.equal(matchesDenaliMarketingCategoryFilter("nature_day", "nature"), true);
    assert.equal(matchesDenaliMarketingCategoryFilter("mountain_multi", "nature"), false);
    assert.equal(matchesDenaliMarketingCategoryFilter("mountain_multi", "mountain_multi"), true);
  });

  it("exposes admin difficulty range 1–10 step 0.5", () => {
    assert.equal(DENALI_MARKETING_DIFFICULTY_LEVELS[0], 1);
    assert.equal(DENALI_MARKETING_DIFFICULTY_LEVELS.at(-1), 10);
    assert.ok(DENALI_MARKETING_DIFFICULTY_LEVELS.includes(6.5));
  });
});
