#!/usr/bin/env node
/**
 * SEO-5++ — production marketing image host allowlist closure.
 * @see docs/dev/guest-seo-conformance.md
 */
import { readFileSync } from "node:fs";
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
  "MARKETING_IMAGE_REMOTE_HOSTS",
  ".env.local.example must document MARKETING_IMAGE_REMOTE_HOSTS for cover optimizer allowlist",
);

assertIncludes(
  "apps/marketing/src/catalog/resolve-marketing-image-hosts.ts",
  "MARKETING_IMAGE_REMOTE_HOSTS",
  "resolve-marketing-image-hosts must read MARKETING_IMAGE_REMOTE_HOSTS",
);

assertIncludes(
  "docs/workspaces/denali/public-catalog.md",
  "MARKETING_IMAGE_REMOTE_HOSTS",
  "public-catalog.md must document MARKETING_IMAGE_REMOTE_HOSTS",
);

assertIncludes(
  "docs/dev/guest-seo-conformance.md",
  "MARKETING_IMAGE_REMOTE_HOSTS",
  "guest-seo-conformance must document production image host policy",
);

const envExample = read("apps/marketing/.env.local.example");
if (/MARKETING_IMAGE_REMOTE_HOSTS=\*/.test(envExample)) {
  fail(".env.local.example must not use wildcard MARKETING_IMAGE_REMOTE_HOSTS");
}

if (violations.length > 0) {
  console.error("guard-marketing-prod-image-hosts: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-marketing-prod-image-hosts: PASS");
