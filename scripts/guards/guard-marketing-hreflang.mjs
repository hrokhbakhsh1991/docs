#!/usr/bin/env node
/**
 * SEO-5++ — hreflang alternates must include fa-IR, en-US, and x-default.
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

const metadata = read("apps/marketing/src/seo/build-marketing-metadata.ts");
for (const key of ["fa-IR", "en-US", "x-default"]) {
  if (!metadata.includes(`"${key}"`)) {
    fail(`build-marketing-metadata must emit ${key} hreflang`);
  }
}

if (!read("apps/marketing/src/seo/build-marketing-sitemap.ts").includes("x-default")) {
  fail("sitemap alternates must include x-default");
}

if (!read("apps/marketing/tests/e2e/marketing-seo-hreflang.spec.ts").includes("SMK-MKT-09")) {
  fail("hreflang smoke spec SMK-MKT-09 must exist");
}

if (violations.length > 0) {
  console.error("guard-marketing-hreflang: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-marketing-hreflang: PASS");
