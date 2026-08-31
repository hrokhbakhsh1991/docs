#!/usr/bin/env node
/**
 * Repo-wide debt-marker ratchet — counted files must not exceed baseline.
 * @see docs/dev/todo-debt-baseline.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE_PATH = path.join(REPO_ROOT, "docs/dev/todo-debt-baseline.json");

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".next",
  ".git",
  "legacy",
  "reports",
]);

const SCAN_EXTENSIONS = /\.(ts|tsx|mjs|cjs|js)$/;

/** @type {string[]} */
const violations = [];

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
const allowlist = new Set(baseline.allowlist ?? []);
const baselineCount = baseline.baselineFileCount ?? 0;

/**
 * @param {string} dir
 * @param {Set<string>} hits
 */
function scanDir(dir, hits) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) {
      continue;
    }
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      scanDir(abs, hits);
      continue;
    }
    if (!SCAN_EXTENSIONS.test(ent.name)) {
      continue;
    }
    const rel = path.relative(REPO_ROOT, abs).replaceAll("\\", "/");
    if (allowlist.has(rel)) {
      continue;
    }
    const source = fs.readFileSync(abs, "utf8");
    if (/\b(TODO|FIXME)\b/.test(source)) {
      hits.add(rel);
    }
  }
}

/** @type {Set<string>} */
const hits = new Set();
for (const root of ["apps", "packages", "scripts"]) {
  scanDir(path.join(REPO_ROOT, root), hits);
}

if (hits.size > baselineCount) {
  violations.push(
    `Outstanding marker file count ${hits.size} exceeds baseline ${baselineCount}: ${[...hits].sort().join(", ")}`
  );
}

for (const rel of hits) {
  if (!allowlist.has(rel) && baseline.allowlist?.includes(rel)) {
    continue;
  }
}

if (violations.length > 0) {
  console.error("guard-todo-debt-budget: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(`guard-todo-debt-budget: PASS (${hits.size}/${baselineCount} files)`);
