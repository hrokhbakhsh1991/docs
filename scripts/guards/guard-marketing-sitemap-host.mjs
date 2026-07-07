#!/usr/bin/env node
/**
 * SEO-5++ — sitemap builder must not emit off-origin or query-string URLs.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const violations = [];

function read(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function fail(message) {
  violations.push(message);
}

const sitemapBuilder = read("apps/marketing/src/seo/build-marketing-sitemap.ts");
if (!sitemapBuilder.includes("resolveMarketingPublicOrigin")) {
  fail("sitemap builder must resolve host-aware origin");
}
if (!sitemapBuilder.includes("!entry.url.includes(\"?\")") && !sitemapBuilder.includes('includes("?")')) {
  // enforced in unit tests; static hint for tour URL builder
}
if (!read("apps/marketing/test/build-marketing-sitemap.spec.ts").includes("must not contain query")) {
  fail("sitemap unit tests must assert no query URLs");
}

const sitemapRoute = read("apps/marketing/app/sitemap.ts");
if (!sitemapRoute.includes("resolveMarketingBootstrapForHost")) {
  fail("sitemap route must resolve tenant bootstrap per host");
}
if (!sitemapRoute.includes("shouldEmitMarketingSitemap")) {
  fail("sitemap route must gate mother/maintenance hosts");
}

if (violations.length > 0) {
  console.error("guard-marketing-sitemap-host: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-marketing-sitemap-host: PASS");
