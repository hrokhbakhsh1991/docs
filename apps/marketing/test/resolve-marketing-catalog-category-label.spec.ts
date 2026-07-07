import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveMarketingCatalogCardCategoryLabel,
  resolveMarketingCatalogCategoryFilterLabel,
} from "../src/catalog/resolve-marketing-catalog-category-label";

const labels: Record<string, string> = {
  "home.full.categories.labels.mountain_multi": "کوهنوردی — چندروزه",
  "home.full.categories.labels.nature_day": "طبیعت — تک‌روزه",
  "list.filters.categoryGroups.mountain": "کوهنوردی",
  "list.filters.categoryGroups.nature": "طبیعت‌گردی",
};

function translate(key: string): string {
  return labels[key] ?? key;
}

describe("resolve-marketing-catalog-category-label.spec.ts — PR-23 card", () => {
  it("MKT-CAT-01 card label uses wizard slug translation", () => {
    assert.equal(
      resolveMarketingCatalogCardCategoryLabel("mountain_multi", translate),
      "کوهنوردی — چندروزه"
    );
  });

  it("MKT-CAT-02 card label falls back to category family", () => {
    assert.equal(
      resolveMarketingCatalogCardCategoryLabel("mountain_day", translate),
      "کوهنوردی"
    );
  });

  it("MKT-CAT-03 filter chip label still resolves group keys", () => {
    assert.equal(
      resolveMarketingCatalogCategoryFilterLabel("mountain", translate, "denali"),
      "کوهنوردی"
    );
  });
});
