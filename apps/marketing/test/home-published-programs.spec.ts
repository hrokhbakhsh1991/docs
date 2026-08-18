/**
 * HOME-UNIT — Denali Published Programs compose (Slice 2).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLISHED_PROGRAMS_MAX } from "../src/home/home-published-programs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("home-published-programs.spec.ts", () => {
  it("caps visible programs at 6 and uses one catalog block", () => {
    assert.equal(PUBLISHED_PROGRAMS_MAX, 6);
    const fullSource = readFileSync(
      join(repoRoot, "apps/marketing/src/home/guest-home-full.tsx"),
      "utf8"
    );
    const programsSource = readFileSync(
      join(repoRoot, "apps/marketing/src/home/home-published-programs.tsx"),
      "utf8"
    );
    const cardSource = readFileSync(
      join(repoRoot, "apps/marketing/src/home/home-published-programs-card.tsx"),
      "utf8"
    );
    assert.match(fullSource, /showPrograms = sections\.featured \|\| sections\.latest/);
    assert.match(fullSource, /HomePublishedPrograms/);
    assert.doesNotMatch(fullSource, /<HomeFeatured/);
    assert.doesNotMatch(fullSource, /<HomeLatestTours/);
    assert.match(fullSource, /nestCategoriesInPrograms/);
    assert.match(programsSource, /htmlFor="home-search-q"/);
    assert.match(programsSource, /name="q"/);
    assert.match(programsSource, /list\.empty/);
    assert.match(programsSource, /HomeCategories categories=\{categories\} embedded/);
    assert.match(programsSource, /home\.full\.latest\.viewAll/);
    assert.match(cardSource, /data-marketing-home-programs-card-link/);
    assert.match(cardSource, /CatalogCoverImage/);
    assert.doesNotMatch(cardSource, /<Link href=\{detailHref\}>\{title\}<\/Link>/);
    assert.doesNotMatch(cardSource, /flagship/);
  });

  it("category chips keep the category query contract", () => {
    const categoriesSource = readFileSync(
      join(repoRoot, "apps/marketing/src/home/home-categories.tsx"),
      "utf8"
    );
    assert.match(categoriesSource, /resolveMarketingToursListPath\(locale, \{ category \}\)/);
    assert.match(categoriesSource, /data-marketing-home-category-chip-id/);
  });
});
