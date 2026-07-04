/**
 * HOME-UNIT-06 — PR-7 discovery section gates + hooks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { deriveHomeCategories } from "../src/home/derive-home-categories";
import { resolveMarketingCategoryLabel } from "../src/home/resolve-marketing-category-label";
import { resolveHomeCatalogFetchLimit } from "../src/home/resolve-home-catalog-fetch-limit";
import { resolveHomeSectionVisibility } from "../src/home/home-section-gates";
import { DISCOVERY_LANDING, FULL_LANDING } from "./home-landing-fixtures";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("home-section-gates-v3.spec.ts — HOME-UNIT-06", () => {
  it("resolveHomeCatalogFetchLimit uses max of latest, featured, and categories floor", () => {
    assert.equal(resolveHomeCatalogFetchLimit(FULL_LANDING), 6);
    assert.equal(resolveHomeCatalogFetchLimit(DISCOVERY_LANDING), 12);
  });

  it("resolveHomeSectionVisibility gates PR-7 sections from manifest + payload", () => {
    assert.deepEqual(resolveHomeSectionVisibility(DISCOVERY_LANDING, 3, 2, 0), {
      hero: true,
      heroSearch: true,
      featured: true,
      latest: true,
      categories: true,
      destinations: true,
      trust: false,
      whyDenali: false,
      journey: false,
      testimonials: false,
      gallery: false,
      equipment: false,
      blogTeaser: false,
      faq: false,
      finalCta: false,
    });
  });

  it("deriveHomeCategories returns unique trimmed category labels", () => {
    assert.deepEqual(
      deriveHomeCategories([
        { id: "a", category: "  Peak  " },
        { id: "b", category: "Peak" },
        { id: "c", category: null },
        { id: "d", category: "Nature" },
      ]),
      ["Peak", "Nature"]
    );
  });

  it("resolveMarketingCategoryLabel maps known slugs and humanizes unknown", () => {
    assert.equal(
      resolveMarketingCategoryLabel("mountain_multi", (key) =>
        key === "home.full.categories.labels.mountain_multi" ? "کوهنوردی — چندروزه" : key
      ),
      "کوهنوردی — چندروزه"
    );
    assert.equal(resolveMarketingCategoryLabel("custom_slug", (key) => key), "custom slug");
  });

  it("GuestHomeFull wires featured, categories, destinations, hero search", () => {
    const fullSource = readFileSync(
      join(repoRoot, "apps/marketing/src/home/guest-home-full.tsx"),
      "utf8"
    );
    assert.match(fullSource, /sections\.featured/);
    assert.match(fullSource, /sections\.categories/);
    assert.match(
      readFileSync(join(repoRoot, "apps/marketing/src/home/home-categories.tsx"), "utf8"),
      /resolveMarketingCategoryLabel/
    );
    assert.match(fullSource, /sections\.destinations/);
    assert.match(fullSource, /showSearch={sections\.heroSearch}/);
  });
});
