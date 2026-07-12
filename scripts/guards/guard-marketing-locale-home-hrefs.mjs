#!/usr/bin/env node
/**
 * MKT-LOCALE-02 — home + catalog surfaces must not emit raw `/tours` hrefs (M9).
 * @see docs/workspaces/denali/public-catalog.md § i18n + RTL (M9)
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const SCAN_ROOTS = [
  "apps/marketing/src/home",
  "apps/marketing/src/catalog",
];

const EXTRA_FILES = ["apps/marketing/app/tours/error.tsx"];

/** @type {RegExp[]} */
const FORBIDDEN = [
  /\bhref=["']\/tours(?:[?"']|$)/,
  /\baction=["']\/tours["']/,
  /\bhref\s*=\s*["']\/tours["']/,
  /\bhref=\{[`"']\/tours\//,
];

/** @type {string[]} */
const violations = [];

function walkTsx(dirRel) {
  /** @type {string[]} */
  const files = [];
  const dir = path.join(REPO_ROOT, dirRel);
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(dirRel, name.name);
    if (name.isDirectory()) {
      files.push(...walkTsx(rel));
      continue;
    }
    if (/\.tsx?$/.test(name.name)) {
      files.push(rel);
    }
  }
  return files;
}

function scanFile(rel) {
  const source = readFileSync(path.join(REPO_ROOT, rel), "utf8");
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of FORBIDDEN) {
      if (pattern.test(line)) {
        violations.push(`${rel}:${i + 1} — raw /tours navigation (${pattern})`);
      }
    }
  }
}

for (const root of SCAN_ROOTS) {
  for (const rel of walkTsx(root)) {
    scanFile(rel);
  }
}

for (const rel of EXTRA_FILES) {
  scanFile(rel);
}

if (violations.length > 0) {
  console.error("guard-marketing-locale-home-hrefs: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-marketing-locale-home-hrefs: PASS");
