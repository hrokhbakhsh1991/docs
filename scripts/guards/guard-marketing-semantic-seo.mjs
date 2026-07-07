#!/usr/bin/env node
/**
 * SEO-5 — static semantic SEO closure for apps/marketing (h1, alt, validated JSON-LD path).
 * @see docs/dev/guest-seo-conformance.md
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

function read(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function fail(message) {
  violations.push(message);
}

function assertIncludes(rel, needle, message) {
  const source = read(rel);
  if (!source.includes(needle)) {
    fail(message);
  }
}

function assertNotMatch(rel, pattern, message) {
  const source = read(rel);
  if (pattern.test(source)) {
    fail(message);
  }
}

function scanSeoDirForPluginBranches() {
  const seoDir = path.join(REPO_ROOT, "apps/marketing/src/seo");
  for (const name of readdirSync(seoDir)) {
    if (!/\.tsx?$/.test(name)) {
      continue;
    }
    const rel = path.join("apps/marketing/src/seo", name);
    const source = read(rel);
    if (/\bif\s*\(\s*pluginId\b/.test(source) || /\bpluginId\s*===/.test(source)) {
      fail(`${rel} must not branch on pluginId (use resolveGuestSeoForPlugin)`);
    }
  }
}

// Single h1 on catalog list and tour detail surfaces.
assertIncludes(
  "apps/marketing/app/tours/page.tsx",
  'data-marketing-catalog-title',
  "tours list page must expose a single catalog h1"
);
assertIncludes(
  "apps/marketing/src/catalog/catalog-tour-detail.tsx",
  "data-marketing-catalog-detail-title",
  "tour detail must expose a single detail h1"
);
assertIncludes(
  "apps/marketing/src/catalog/catalog-tour-detail.tsx",
  "<h1",
  "tour detail must render h1"
);

// Cover images must accept alt text for accessibility + SEO.
assertIncludes(
  "apps/marketing/src/catalog/catalog-cover-image.tsx",
  "alt",
  "catalog cover image component must support alt"
);

// JSON-LD must pass SDK validation before render.
assertIncludes(
  "apps/marketing/src/seo/build-validated-marketing-structured-data.ts",
  "validateStructuredData",
  "marketing structured data must validate via workspace-sdk"
);

// Metadata must declare OG image dimensions (MKT-32).
assertIncludes(
  "apps/marketing/src/seo/build-marketing-metadata.ts",
  "width:",
  "build-marketing-metadata must declare OG image width"
);
assertIncludes(
  "apps/marketing/src/seo/build-marketing-metadata.ts",
  "height:",
  "build-marketing-metadata must declare OG image height"
);

// Hreflang + layout graph JSON-LD (SEO-4 carry-over).
assertIncludes(
  "apps/marketing/src/seo/build-marketing-metadata.ts",
  "languages",
  "build-marketing-metadata must emit hreflang alternates"
);
assertIncludes(
  "apps/marketing/app/layout.tsx",
  "buildMarketingLayoutJsonLd",
  "marketing layout must emit Organization/WebSite JSON-LD"
);

// SEO-5+ visible breadcrumb nav aligned with JSON-LD.
assertIncludes(
  "apps/marketing/src/catalog/catalog-tour-breadcrumb.tsx",
  'aria-label="Breadcrumb"',
  "tour detail must render visible breadcrumb navigation"
);
assertIncludes(
  "apps/marketing/src/catalog/catalog-tour-detail.tsx",
  "CatalogTourBreadcrumb",
  "catalog tour detail must include breadcrumb nav component"
);
assertIncludes(
  "apps/marketing/app/tours/page.tsx",
  "shouldNoindexMarketingListPage",
  "tours list metadata must honor pagination noindex policy"
);
assertIncludes(
  "apps/marketing/app/tours/page.tsx",
  "buildMarketingCatalogListJsonLd",
  "tours list page must emit ItemList JSON-LD on first page"
);
assertIncludes(
  "apps/marketing/src/seo/build-marketing-sitemap.ts",
  "images:",
  "sitemap builder must emit image entries for tour covers"
);
assertIncludes(
  "apps/marketing/src/catalog/catalog-tour-detail.tsx",
  "buildMarketingTourDetailJsonLdGraph",
  "tour detail must bundle JSON-LD into @graph"
);
assertIncludes(
  "apps/marketing/src/seo/serialize-marketing-jsonld.ts",
  "serializeMarketingJsonLd",
  "marketing must expose XSS-safe JSON-LD serializer"
);

// Validator + lighthouse config wired for SEO-5.
if (!existsSync(path.join(REPO_ROOT, "scripts/validate-json-ld.mjs"))) {
  fail("scripts/validate-json-ld.mjs must exist");
}
assertIncludes(
  "scripts/guards/guard-guest-seo.mjs",
  "validate-json-ld.mjs",
  "guard-guest-seo must invoke validate-json-ld.mjs"
);

const lighthouseConfig = path.join(REPO_ROOT, "apps/marketing/lighthouserc.json");
if (!existsSync(lighthouseConfig)) {
  fail("apps/marketing/lighthouserc.json must exist");
} else {
  const config = read("apps/marketing/lighthouserc.json");
  if (!config.includes("categories:seo") || !config.includes("0.9")) {
    fail("lighthouserc.json must assert SEO score >= 0.9");
  }
  if (!config.includes("categories:performance") || !config.includes("0.85")) {
    fail("lighthouserc.json must assert Performance score >= 0.85");
  }
}

// Marketing SEO modules must stay plugin-neutral.
scanSeoDirForPluginBranches();
assertNotMatch(
  "apps/marketing/src/seo/build-marketing-metadata.ts",
  /\bif\s*\(\s*pluginId\b/,
  "build-marketing-metadata must not branch on pluginId"
);

if (violations.length > 0) {
  console.error("guard-marketing-semantic-seo: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-marketing-semantic-seo: PASS");
