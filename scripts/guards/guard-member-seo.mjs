#!/usr/bin/env node
/**
 * PS-4 — portal member SEO crawl boundary guard (DL-39).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

const robotsPath = path.join(REPO_ROOT, "apps/portal/app/robots.ts");
if (!fs.existsSync(robotsPath)) {
  violations.push("apps/portal/app/robots.ts is missing");
} else {
  const robots = fs.readFileSync(robotsPath, "utf8");
  if (!robots.includes('disallow: ["/api/"]') && !robots.includes('"/api/"')) {
    violations.push("robots.ts must disallow /api/");
  }
}

const meLayout = fs.readFileSync(path.join(REPO_ROOT, "apps/portal/app/me/layout.tsx"), "utf8");
if (!meLayout.includes("robots:") || !meLayout.includes("index: false")) {
  violations.push("apps/portal/app/me/layout.tsx must set noindex metadata");
}

const registerPage = fs.readFileSync(
  path.join(REPO_ROOT, "apps/portal/app/catalog/[tourId]/register/page.tsx"),
  "utf8"
);
if (!registerPage.includes("robots:") || !registerPage.includes("index: false")) {
  violations.push("register page must set noindex metadata");
}

if (violations.length > 0) {
  console.error("guard-member-seo: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-member-seo: PASS");
