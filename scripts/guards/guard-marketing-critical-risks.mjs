#!/usr/bin/env node
/**
 * R-04 — marketing CRITICAL risks (C1–C3). Hard block until MKT-8..10.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

const coverImage = readFileSync(
  path.join(REPO_ROOT, "apps/marketing/src/catalog/catalog-cover-image.tsx"),
  "utf8"
);
if (/style=\{/.test(coverImage)) {
  violations.push("R-04/C1: catalog-cover-image.tsx has inline visual style override");
}

const shell = readFileSync(
  path.join(REPO_ROOT, "apps/marketing/src/shell/marketing-shell.tsx"),
  "utf8"
);
if (!/id="main-content"/.test(shell)) {
  violations.push("R-04/C2: marketing-shell.tsx missing id=\"main-content\" on tenant shell wrapper");
}

const globals = readFileSync(path.join(REPO_ROOT, "apps/marketing/app/globals.css"), "utf8");
if (/platform-infra-shell\.css/.test(globals)) {
  violations.push("R-04/C3: marketing globals.css imports platform-infra-shell (not import-only)");
}

if (violations.length > 0) {
  console.error("guard-marketing-critical-risks: BLOCKED R-04");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-marketing-critical-risks: PASS");
