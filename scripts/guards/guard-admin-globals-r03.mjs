#!/usr/bin/env node
/**
 * R-03 — admin globals.css appearance monolith (not import-only).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GLOBALS = path.join(REPO_ROOT, "apps/web/app/globals.css");

const source = readFileSync(GLOBALS, "utf8");
const lines = source.split("\n");

/** @type {string[]} */
const violations = [];

let pastImports = false;
let appearanceRuleCount = 0;

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
    continue;
  }
  if (/^@import\s/.test(trimmed)) {
    continue;
  }
  if (/^@tailwind/.test(trimmed)) {
    continue;
  }
  pastImports = true;
  if (/^\.[a-zA-Z]|^\.dark|^\.theme-|--color-/.test(trimmed)) {
    appearanceRuleCount += 1;
  }
}

if (appearanceRuleCount > 0) {
  violations.push(
    `R-03: apps/web/app/globals.css has ${appearanceRuleCount} appearance rule blocks (must be import-only)`
  );
}

if (violations.length > 0) {
  console.error("guard-admin-globals-r03: BLOCKED R-03");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-admin-globals-r03: PASS");
