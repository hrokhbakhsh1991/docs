#!/usr/bin/env node
/**
 * MKT-6 — forbid Denali-specific catalog modules under apps/marketing.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG_DIR = path.join(REPO_ROOT, "apps/marketing/src/catalog");

const FORBIDDEN = [
  "denali-catalog-filter-config.ts",
  "resolve-denali-marketing-category-family.ts",
  "resolve-marketing-denali-plugin.ts",
  "resolve-catalog-detail-denali-pdp-gates.ts",
];

/** @type {string[]} */
const violations = [];

for (const file of FORBIDDEN) {
  const abs = path.join(CATALOG_DIR, file);
  if (existsSync(abs)) {
    violations.push(`apps/marketing/src/catalog/${file} must move to workspace-denali/marketing`);
  }
}

if (violations.length > 0) {
  console.error("guard-marketing-denali-boundary: FAIL");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("guard-marketing-denali-boundary: PASS");
