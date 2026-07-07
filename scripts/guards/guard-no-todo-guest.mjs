#!/usr/bin/env node
/**
 * PF-4.5 / Z10 — guest registry outputs must not carry TODO/FIXME placeholders.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const ROOTS = [
  "packages/workspace-sdk/src/catalog",
  "packages/workspace-sdk/src/profile",
  "packages/guest-surface-host/src",
  "packages/workspace-plugin-host/src",
];

/** @type {string[]} */
const violations = [];

function scanDir(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      scanDir(p);
      continue;
    }
    if (!/\.(ts|tsx|mjs)$/.test(ent.name)) {
      continue;
    }
    const source = fs.readFileSync(p, "utf8");
    if (/\b(TODO|FIXME)\b/.test(source)) {
      violations.push(path.relative(REPO_ROOT, p));
    }
  }
}

for (const rel of ROOTS) {
  scanDir(path.join(REPO_ROOT, rel));
}

if (violations.length > 0) {
  console.error("guard-no-todo-guest: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-no-todo-guest: PASS");
