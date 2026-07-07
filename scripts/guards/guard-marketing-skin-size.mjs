#!/usr/bin/env node
/**
 * MKT-3 — workspace marketing skin partials must stay ≤500 lines (TARGET-INDUSTRIAL).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MAX_LINES = 500;

/** @type {string[]} */
const violations = [];

function fail(message) {
  violations.push(message);
}

function walkCssFiles(dirAbs) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
    const abs = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) files.push(...walkCssFiles(abs));
    else if (entry.name.endsWith(".css")) files.push(abs);
  }
  return files;
}

const workspaces = [
  {
    id: "denali",
    entry: "packages/workspaces/denali/theme/denali-marketing.css",
    partialsDir: "packages/workspaces/denali/theme/marketing",
  },
  {
    id: "urban",
    entry: "packages/workspaces/urban/theme/urban-marketing.css",
    partialsDir: "packages/workspaces/urban/theme/marketing",
  },
];

for (const ws of workspaces) {
  const entryAbs = path.join(REPO_ROOT, ws.entry);
  const partialsAbs = path.join(REPO_ROOT, ws.partialsDir);

  if (!existsSync(entryAbs)) {
    fail(`${ws.id}: missing marketing entry ${ws.entry}`);
    continue;
  }

  const entry = readFileSync(entryAbs, "utf8");
  if (!entry.includes("@import")) {
    const lineCount = entry.split("\n").length;
    if (lineCount > MAX_LINES) {
      fail(`${ws.id}: monolith ${ws.entry} has ${lineCount} lines (max ${MAX_LINES})`);
    }
    continue;
  }

  if (!existsSync(partialsAbs)) {
    fail(`${ws.id}: split entry requires ${ws.partialsDir}`);
    continue;
  }

  for (const fileAbs of walkCssFiles(partialsAbs)) {
    const rel = path.relative(REPO_ROOT, fileAbs);
    const lineCount = readFileSync(fileAbs, "utf8").split("\n").length;
    if (lineCount > MAX_LINES) {
      fail(`${rel}: ${lineCount} lines (max ${MAX_LINES})`);
    }
  }

  const entryLines = entry.split("\n").length;
  if (entryLines > 80) {
    fail(`${ws.entry}: split entry must be import-only (got ${entryLines} lines)`);
  }
}

if (violations.length > 0) {
  console.error("guard-marketing-skin-size: FAIL");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("guard-marketing-skin-size: PASS");
