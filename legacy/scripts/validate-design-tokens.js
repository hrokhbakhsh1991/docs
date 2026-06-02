#!/usr/bin/env node
/**
 * Validates design tokens (packages/ui/src/tokens/*.css) against docs/10-product/design_system.md:
 * - Every `--*` token defined in the doc's ```css blocks must exist in the combined token CSS files.
 * - Optional (CI): TOKEN_COMPARE_REF — no token name may disappear vs base branch (no silent removals).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DOC_PATH = path.join(ROOT, "docs", "10-product", "design_system.md");
/** Token definitions are split across light + dark; validation merges variable names from both. */
const TOKEN_FILES_REL = [
  "packages/ui/src/tokens/light.css",
  "packages/ui/src/tokens/dark.css",
];

function extractDefinedVars(cssText) {
  const names = new Set();
  for (const line of cssText.split("\n")) {
    const m = line.match(/^\s*(--[a-z0-9-]+)\s*:/);
    if (m) names.add(m[1]);
  }
  return names;
}

function extractDocCssBlocks(markdown) {
  const blocks = [];
  const re = /```css\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(markdown))) {
    blocks.push(m[1]);
  }
  return blocks;
}

function readCombinedTokensFromDisk() {
  let combined = "";
  for (const rel of TOKEN_FILES_REL) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) {
      process.exit(1);
    }
    combined += fs.readFileSync(p, "utf8") + "\n";
  }
  return combined;
}

function readCombinedTokensFromGit(compareRef) {
  const parts = [];
  for (const rel of TOKEN_FILES_REL) {
    try {
      parts.push(
        execSync(`git show ${compareRef}:${rel}`, {
          encoding: "utf8",
          cwd: ROOT,
          stdio: ["pipe", "pipe", "pipe"],
        }),
      );
    } catch {
      return null;
    }
  }
  return parts.join("\n");
}

function readDocOrExit() {
  if (!fs.existsSync(DOC_PATH)) {
    process.exit(1);
  }
  return fs.readFileSync(DOC_PATH, "utf8");
}

function compareRemovalGuard(cssNow, compareRef) {
  if (!compareRef) return;
  const cssBefore = readCombinedTokensFromGit(compareRef.trim());
  if (!cssBefore) {
    return;
  }

  const before = extractDefinedVars(cssBefore);
  const after = extractDefinedVars(cssNow);
  const removed = [...before].filter((name) => !after.has(name));
  if (removed.length > 0) {
    process.exit(1);
  }
}

function main() {
  const css = readCombinedTokensFromDisk();
  const md = readDocOrExit();

  const docBlocks = extractDocCssBlocks(md);
  if (docBlocks.length === 0) {
    process.exit(1);
  }

  const docRequired = new Set();
  for (const block of docBlocks) {
    for (const name of extractDefinedVars(block)) {
      docRequired.add(name);
    }
  }

  const implemented = extractDefinedVars(css);
  const missing = [...docRequired].filter((name) => !implemented.has(name)).sort();

  if (missing.length > 0) {
    process.exit(1);
  }

  const compareRef = process.env.TOKEN_COMPARE_REF || "";
  compareRemovalGuard(css, compareRef.trim());

}

main();
