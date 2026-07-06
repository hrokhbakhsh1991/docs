#!/usr/bin/env node
/**
 * MKT-PRIM-01 — marketing app uses ui-primitives policy (no shadcn in src).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(REPO_ROOT, "apps/marketing/src");

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
    if (/@\/components\/ui\//.test(source) || /from ["']@radix-ui/.test(source)) {
      violations.push(path.relative(REPO_ROOT, abs));
    }
  }
}

if (existsSync(SRC)) {
  walk(SRC);
}

if (violations.length > 0) {
  console.error("guard-marketing-primitives: FAIL — shadcn/radix imports in marketing src");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("guard-marketing-primitives: PASS");
