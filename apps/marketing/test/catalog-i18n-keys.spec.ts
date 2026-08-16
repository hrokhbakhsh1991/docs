/**
 * HOME-UNIT-08 — fa/en parity for catalog list filter i18n keys (PR-21 / PR-22).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const REQUIRED_LIST_KEYS = [
  "list.title",
  "list.lead",
  "list.empty",
  "list.emptyFiltered",
  "list.viewTour",
  "list.loadMore",
  "list.loadMoreSearch",
  "list.resultsCountPage",
  "list.paginationFirstPage",
  "list.resultsCount",
  "list.resultsCountFiltered",
  "list.filterScopeNotice",
  "list.searchActive",
  "list.categoryActive",
  "list.cityActive",
  "list.filters.searchLabel",
  "list.filters.searchPlaceholder",
  "list.filters.panelTitle",
  "list.filters.activeLabel",
  "list.filters.reset",
  "list.filters.availabilityLabel",
  "list.filters.difficultyOption",
  "list.filters.categoryGroups.mountain",
  "list.filters.categoryGroups.nature",
  "list.filters.sortLabel",
  "list.filters.sort.newest",
  "list.filters.sort.departureAsc",
  "list.filters.sort.departureDesc",
  "list.filters.sort.priceAsc",
  "list.filters.sort.priceDesc",
  "list.filters.sort.difficultyAsc",
  "list.filters.difficultyLabel",
  "list.filters.fitnessLabel",
  "list.filters.availabilityOpen",
  "list.filters.categoryLabel",
  "list.filters.allCategories",
  "list.filters.all",
  "list.filters.apply",
  "list.filters.clearAll",
  "list.filters.fitnessLevels.low",
  "list.filters.fitnessLevels.medium",
  "list.filters.fitnessLevels.high",
  "list.card.soldOut",
  "list.card.summary.singleDay",
  "list.card.summary.multiDay",
  "list.card.summary.difficulty",
  "list.card.summary.capacity",
  "list.card.summary.openSpots",
] as const;

function readCatalogMessages(locale: "en" | "fa"): Record<string, unknown> {
  const path = join(repoRoot, "apps/marketing/messages", locale, "catalog.json");
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function readNestedValue(source: Record<string, unknown>, dottedKey: string): unknown {
  let current: unknown = source;
  for (const segment of dottedKey.split(".")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

describe("catalog-i18n-keys.spec.ts — HOME-UNIT-08", () => {
  it("fa and en define the same catalog list filter keys", () => {
    const en = readCatalogMessages("en");
    const fa = readCatalogMessages("fa");
    const enKeys = REQUIRED_LIST_KEYS.filter((key) => {
      const value = readNestedValue(en, key);
      return typeof value === "string" && value.trim().length > 0;
    });
    const faKeys = REQUIRED_LIST_KEYS.filter((key) => {
      const value = readNestedValue(fa, key);
      return typeof value === "string" && value.trim().length > 0;
    });

    assert.deepEqual(faKeys.sort(), enKeys.sort());
    assert.deepEqual(enKeys.sort(), [...REQUIRED_LIST_KEYS].sort());
  });

  it("BUG-14 seo.toursTitle is a segment without {siteName}", () => {
    for (const locale of ["en", "fa"] as const) {
      const title = readNestedValue(readCatalogMessages(locale), "seo.toursTitle");
      assert.equal(typeof title, "string");
      assert.doesNotMatch(String(title), /\{siteName\}/);
      assert.ok(String(title).trim().length > 0);
    }
  });

  it("BUG-15 emptyFiltered does not mention load-more", () => {
    for (const locale of ["en", "fa"] as const) {
      const emptyFiltered = readNestedValue(readCatalogMessages(locale), "list.emptyFiltered");
      assert.equal(typeof emptyFiltered, "string");
      assert.doesNotMatch(String(emptyFiltered), /load more|نمایش بیشتر/i);
      assert.match(String(emptyFiltered), /Reset|بازنشانی|clear|پاک/i);
    }
  });

  it("BUG-16 page and tour 404 keys stay distinct", () => {
    for (const locale of ["en", "fa"] as const) {
      const messages = readCatalogMessages(locale);
      const pageTitle = readNestedValue(messages, "pageNotFound.title");
      const tourTitle = readNestedValue(messages, "notFound.title");
      const pageBody = readNestedValue(messages, "pageNotFound.body");
      const tourBody = readNestedValue(messages, "notFound.body");
      assert.equal(typeof pageTitle, "string");
      assert.equal(typeof tourTitle, "string");
      assert.notEqual(pageTitle, tourTitle);
      assert.doesNotMatch(String(pageTitle), /Tour|تور/);
      assert.match(String(tourTitle), /Tour|تور/);
      assert.doesNotMatch(String(pageBody), /\btour\b|تور/i);
      assert.match(String(tourBody), /tour|تور/i);
    }
  });
});
