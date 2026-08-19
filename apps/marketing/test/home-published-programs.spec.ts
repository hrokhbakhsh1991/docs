/**
 * HOME-UNIT — Denali Published Programs compose (Slice 2).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("home-published-programs.spec.ts", () => {
  it("caps visible programs at 6 and uses one catalog block", () => {
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
    assert.match(programsSource, /export const PUBLISHED_PROGRAMS_MAX = 6/);
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
    assert.match(programsSource, /data-programs-count=\{visibleItems\.length\}/);
    assert.doesNotMatch(cardSource, /flagship/);
  });

  it("adaptive grid CSS composes 1–6 items without a 3+1 orphan", () => {
    const css = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/marketing/home/programs.css"),
      "utf8"
    );
    assert.match(css, /data-programs-count="1"/);
    assert.match(css, /data-programs-count="2"/);
    assert.match(css, /data-programs-count="4"/);
    assert.match(css, /max-width: 50rem/);
    assert.match(css, /max-width: 24rem/);
    assert.match(css, /justify-content: center/);
    assert.match(css, /--programs-card-3:/);
    assert.match(css, /@media \(max-width: 47\.9375rem\)/);
    assert.match(css, /grid-template-columns: 8\.75rem minmax\(0, 1fr\)/);
    assert.match(css, /scroll-snap-type: none/);
    assert.doesNotMatch(css, /grid-template-columns: repeat\(3,/);
    assert.doesNotMatch(css, /scroll-snap-type:\s*x/);
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
