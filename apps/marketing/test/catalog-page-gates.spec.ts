/**
 * HOME-UNIT-09 — tours list page wiring gates (PR-21 / PR-22).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pagePath = join(repoRoot, "apps/marketing/app/tours/page.tsx");
const bffPath = join(repoRoot, "apps/marketing/app/api/catalog/route.ts");

describe("catalog-page-gates.spec.ts — HOME-UNIT-09", () => {
  const source = readFileSync(pagePath, "utf8");
  const bffSource = readFileSync(bffPath, "utf8");

  it("wires filter bar, server fetch filters, and pipeline", () => {
    assert.match(source, /<CatalogTourFilterBar/);
    assert.match(source, /fetchCatalogList\([\s\S]*filters,/);
    assert.match(source, /applyMarketingCatalogListPipeline\(/);
    assert.match(source, /serverListFilters/);
    assert.match(source, /catalogFiltersToNoindexSearchParams/);
  });

  it("exposes catalog discovery hooks", () => {
    assert.match(source, /data-marketing-catalog-lead/);
    assert.match(source, /data-marketing-catalog-results/);
    assert.match(source, /data-marketing-catalog-filter-notice/);
    assert.match(source, /data-marketing-catalog-pagination-next/);
    assert.match(source, /buildCatalogListHref/);
    assert.match(source, /resolveMarketingLocalePath\("\/tours"/);
  });

  it("BFF list route shares PR-22 query builder with server fetch", () => {
    assert.match(bffSource, /buildCatalogListFetchQuery/);
    assert.match(bffSource, /parseCatalogListFilters/);
    assert.match(bffSource, /availability/);
    assert.match(bffSource, /sort/);
  });

  it("BUG-14 list metadata fallback is the tours label segment", () => {
    assert.match(source, /guestSeo\.listTitleKey/);
    assert.match(source, /t\("nav\.tours"\)/);
    assert.doesNotMatch(source, /`\$\{siteName\} — \$\{t\("nav\.tours"\)\}`/);
  });
});
