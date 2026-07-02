#!/usr/bin/env node
/**
 * SEO-5++ — marketing metadata quality closure (title, description, canonical, og:locale).
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

function assertIncludes(rel, needle, message) {
  if (!read(rel).includes(needle)) {
    fail(message);
  }
}

assertIncludes(
  "apps/marketing/src/seo/build-marketing-metadata.ts",
  "resolveMarketingOpenGraphLocale",
  "metadata must set openGraph.locale"
);
assertIncludes(
  "apps/marketing/src/seo/build-marketing-metadata.ts",
  "buildMarketingSurfaceNoindexMetadata",
  "metadata must expose surface noindex helper"
);
assertIncludes(
  "apps/marketing/app/not-found.tsx",
  "generateMetadata",
  "global not-found must define generateMetadata"
);
assertIncludes(
  "apps/marketing/app/page.tsx",
  "alternates",
  "club home page must declare canonical alternates"
);
assertIncludes(
  "apps/marketing/app/layout.tsx",
  "buildMarketingSurfaceNoindexMetadata",
  "layout must noindex mother/maintenance surfaces"
);
assertIncludes(
  "apps/web/app/(public)/catalog/page.tsx",
  "permanentRedirect",
  "web catalog list must use permanentRedirect (308)"
);
assertIncludes(
  "apps/web/app/(public)/catalog/[tourId]/page.tsx",
  "permanentRedirect",
  "web catalog detail must use permanentRedirect (308)"
);

if (violations.length > 0) {
  console.error("guard-marketing-meta-quality: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-marketing-meta-quality: PASS");
