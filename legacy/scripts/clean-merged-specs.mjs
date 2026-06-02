#!/usr/bin/env node
/**
 * Strip stem-merge tail blocks from colocated spec files.
 * Truncates each file before the first `/* merged from` marker.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const MERGE_MARKER = "/* merged from";

const SCAN_DIRS = [
  "apps/web/src/features/tours/wizard/denali/validation",
  "apps/web/src/features/tours/wizard/schemas",
];

function listSpecFiles(dirAbs) {
  if (!fs.existsSync(dirAbs)) {
    return [];
  }
  return fs
    .readdirSync(dirAbs, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.spec\.(ts|tsx)$/.test(entry.name))
    .map((entry) => path.join(dirAbs, entry.name));
}

function truncateMergedTail(absPath) {
  const rel = path.relative(REPO_ROOT, absPath).replace(/\\/g, "/");
  const original = fs.readFileSync(absPath, "utf8");
  const markerIndex = original.indexOf(MERGE_MARKER);

  if (markerIndex === -1) {
    return { rel, changed: false };
  }

  const truncated = `${original.slice(0, markerIndex).replace(/\s+$/, "")}\n`;
  fs.writeFileSync(absPath, truncated, "utf8");

  const beforeLines = original.split("\n").length;
  const afterLines = truncated.split("\n").length;

  return {
    rel,
    changed: true,
    beforeLines,
    afterLines,
    removedLines: beforeLines - afterLines,
  };
}

let changedCount = 0;

for (const relDir of SCAN_DIRS) {
  const absDir = path.join(REPO_ROOT, relDir);
  for (const specPath of listSpecFiles(absDir)) {
    const result = truncateMergedTail(specPath);
    if (result.changed) {
      changedCount += 1;
      console.log(
        `truncated ${result.rel}: ${result.beforeLines} -> ${result.afterLines} lines (-${result.removedLines})`,
      );
    } else {
      console.log(`unchanged ${result.rel}`);
    }
  }
}

console.log(`\nclean-merged-specs: ${changedCount} file(s) truncated.`);
