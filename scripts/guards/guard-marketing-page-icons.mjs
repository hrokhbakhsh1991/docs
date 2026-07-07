#!/usr/bin/env node
/**
 * MKT-ICON-01 — page chrome must not pass Lucide size/strokeWidth (skin owns metrics).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOTS = [
  path.join(REPO_ROOT, "apps/marketing/src/catalog"),
  path.join(REPO_ROOT, "apps/marketing/src/home"),
];

const ICON_METRICS = /\b(size|strokeWidth)=\{/;

/** @type {string[]} */
const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      walk(abs);
      continue;
    }
    if (!/\.(tsx|ts)$/.test(entry)) {
      continue;
    }
    const source = readFileSync(abs, "utf8");
    if (ICON_METRICS.test(source)) {
      violations.push(path.relative(REPO_ROOT, abs));
    }
  }
}

for (const root of ROOTS) {
  walk(root);
}

if (violations.length > 0) {
  console.error("guard-marketing-page-icons: FAIL");
  for (const v of violations) console.error(`  - ${v} contains Lucide size/strokeWidth`);
  process.exit(1);
}

console.log("guard-marketing-page-icons: PASS");
