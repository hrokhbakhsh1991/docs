#!/usr/bin/env node
/**
 * SEO-5+ — production marketing SEO closure (HTTPS public origin).
 * @see docs/dev/guest-seo-conformance.md
 */
import { existsSync, readFileSync } from "node:fs";
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

assertIncludes(
  "apps/marketing/.env.local.example",
  "MARKETING_PUBLIC_BASE_URL",
  ".env.local.example must document MARKETING_PUBLIC_BASE_URL for production SEO"
);

const envExample = read("apps/marketing/.env.local.example");
if (!/MARKETING_PUBLIC_BASE_URL=https:\/\//.test(envExample)) {
  fail(".env.local.example must show https:// MARKETING_PUBLIC_BASE_URL");
}

assertIncludes(
  "apps/marketing/src/seo/build-marketing-metadata.ts",
  "metadataBase",
  "build-marketing-metadata must set metadataBase for canonical/OG resolution"
);

assertIncludes(
  "docs/dev/guest-seo-conformance.md",
  "MARKETING_PUBLIC_BASE_URL",
  "guest-seo-conformance must document production HTTPS origin policy"
);

const lighthouseConfig = path.join(REPO_ROOT, "apps/marketing/lighthouserc.json");
if (!existsSync(lighthouseConfig)) {
  fail("apps/marketing/lighthouserc.json must exist");
} else {
  const config = read("apps/marketing/lighthouserc.json");
  if (!config.includes("categories:performance") || !config.includes("0.85")) {
    fail("lighthouserc.json must assert Performance score >= 0.85");
  }
}

if (violations.length > 0) {
  console.error("guard-marketing-seo-prod: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-marketing-seo-prod: PASS");
