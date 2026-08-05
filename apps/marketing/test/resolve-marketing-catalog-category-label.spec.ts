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
  it("MKT-CAT-01 card label uses wizard slug translation", async () => {
    assert.equal(
      await resolveMarketingCatalogCardCategoryLabel("mountain_multi", translate),
      "کوهنوردی — چندروزه"
    );
  });

  it("MKT-CAT-02 card label falls back to category family", async () => {
    assert.equal(
      await resolveMarketingCatalogCardCategoryLabel("mountain_day", translate),
      "کوهنوردی"
    );
  });

  it("MKT-CAT-03 filter chip label still resolves group keys", async () => {
    assert.equal(
      await resolveMarketingCatalogCategoryFilterLabel("mountain", translate, "denali"),
      "کوهنوردی"
    );
  });

  it("MKT-CAT-04 unknown city slug falls back without throwing (next-intl MISSING_MESSAGE)", async () => {
    const throwingTranslate = ((key: string) => {
      throw Object.assign(new Error(`MISSING_MESSAGE:${key}`), { code: "MISSING_MESSAGE" });
    }) as (key: string) => string;
    assert.equal(
      await resolveMarketingCatalogCardCategoryLabel("Berlin", throwingTranslate),
      "Berlin"
    );
  });
});
