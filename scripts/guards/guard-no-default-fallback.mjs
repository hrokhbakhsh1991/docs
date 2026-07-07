#!/usr/bin/env node
/**
 * PF-1.9 / G1.2 — guest resolver maps must not silently default unknown plugins.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const TARGETS = [
  "packages/workspace-sdk/src/catalog/resolve-catalog-api-path.ts",
  "packages/workspace-sdk/src/catalog/resolve-catalog-list-features.ts",
  "packages/workspace-sdk/src/catalog/resolve-catalog-detail-sections.ts",
  "packages/workspace-sdk/src/catalog/resolve-guest-conformance-level.ts",
  "packages/workspace-sdk/src/profile/resolve-member-profile-capabilities.ts",
  "packages/guest-surface-host/src/resolve-dev-plugin-id.ts",
];

/** @type {RegExp[]} */
const FORBIDDEN = [
  /\?\?\s*["']denali["']/,
  /\?\?\s*["']urban["']/,
  /DEFAULT_FEATURES/,
  /DEFAULT_SECTIONS/,
  /DEFAULT_CATALOG_/,
];

/** @type {string[]} */
const violations = [];

for (const rel of TARGETS) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    violations.push(`${rel}: missing`);
    continue;
  }
  const source = fs.readFileSync(abs, "utf8");
  for (const pattern of FORBIDDEN) {
    if (pattern.test(source)) {
      violations.push(`${rel}: forbidden pattern ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-no-default-fallback: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-no-default-fallback: PASS");
