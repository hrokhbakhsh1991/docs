#!/usr/bin/env node
/**
 * CSS-G-01 — apps globals.css must be import-only.
 * @see docs/dev/guard-css-integrity.md
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertGlobalsImportOnly } from "./css-ownership-lib.mjs";
import fs from "node:fs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const GLOBALS_FILES = [
  "apps/portal/app/globals.css",
  "apps/marketing/app/globals.css",
  "apps/web/app/globals.css",
];

/** @type {string[]} */
const violations = [];

for (const rel of GLOBALS_FILES) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    violations.push(`${rel}: missing`);
    continue;
  }
  violations.push(...assertGlobalsImportOnly(fs.readFileSync(abs, "utf8"), rel));
}

if (violations.length > 0) {
  console.error("guard-css-globals-import-only: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-css-globals-import-only: PASS");
