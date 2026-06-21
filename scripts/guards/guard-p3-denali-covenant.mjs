#!/usr/bin/env node
/**
 * P3 Denali scoped covenant — block metadata SoT edits; allow overlay paths.
 * @see docs/phase-16/platform-workspace-cutover.mdoc §G7
 * @see TEMP/p3/p3-denali-safety.md
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DENALI_PREFIX = "packages/workspaces/denali/";

/** Metadata layout SoT — must not change during P3 overlay work. */
const FORBIDDEN_PREFIXES = [
  "src/field-registry/",
  "src/rules/",
  "src/composites/",
];

const FORBIDDEN_FILES = new Set([
  "src/denali-plugin-adapter.ts",
  "src/denali.plugin.ts",
]);

function listChangedDenaliPaths() {
  const names = new Set();
  for (const args of [
    ["diff", "--name-only", "HEAD", "--", "packages/workspaces/denali"],
    ["diff", "--name-only", "--cached", "--", "packages/workspaces/denali"],
    ["diff", "--name-only", "--", "packages/workspaces/denali"],
  ]) {
    const output = execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
    if (output.length === 0) {
      continue;
    }
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        names.add(trimmed);
      }
    }
  }
  return [...names].sort();
}

function relativeDenaliPath(repoPath) {
  if (!repoPath.startsWith(DENALI_PREFIX)) {
    return null;
  }
  return repoPath.slice(DENALI_PREFIX.length);
}

function isForbiddenChange(relativePath) {
  if (FORBIDDEN_FILES.has(relativePath)) {
    return true;
  }
  return FORBIDDEN_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

const changed = listChangedDenaliPaths();
const violations = [];

for (const repoPath of changed) {
  const relativePath = relativeDenaliPath(repoPath);
  if (relativePath === null) {
    continue;
  }
  if (isForbiddenChange(relativePath)) {
    violations.push(relativePath);
  }
}

if (violations.length === 0) {
  const summary =
    changed.length === 0
      ? "no denali diff"
      : `${changed.length} overlay path(s) ok`;
  console.log(`guard-p3-denali-covenant — PASS (${summary})`);
  process.exit(0);
}

console.error("guard-p3-denali-covenant — FAIL");
for (const file of violations) {
  console.error(`  FORBIDDEN: packages/workspaces/denali/${file}`);
}
console.error(
  "Metadata SoT paths are frozen during P3. Overlay edits must stay under wizard/, theme/, manifest, README, package.json exports."
);
process.exit(1);
