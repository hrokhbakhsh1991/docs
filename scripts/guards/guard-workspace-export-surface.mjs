#!/usr/bin/env node
/**
 * Phase 6 P2 — workspace package.json exports must be Plugin Contract + ./host/* only.
 * @see docs/dev/denali-plugin-encapsulation.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES_DIR = path.join(REPO_ROOT, "packages/workspaces");

/** @param {string} key */
function isAllowedExportKey(key) {
  if (key === ".") return true;
  if (key === "./plugin") return true;
  if (key.startsWith("./theme/")) return true;
  if (key.startsWith("./settings/")) return true;
  if (key.startsWith("./host/")) return true;
  return false;
}

/** @type {string[]} */
const violations = [];

for (const ent of fs.readdirSync(WORKSPACES_DIR, { withFileTypes: true })) {
  if (!ent.isDirectory()) continue;
  const pkgPath = path.join(WORKSPACES_DIR, ent.name, "package.json");
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (pkg.exports === undefined || typeof pkg.exports !== "object") continue;
  for (const key of Object.keys(pkg.exports)) {
    if (!isAllowedExportKey(key)) {
      violations.push(`${ent.name}/package.json — disallowed export key "${key}"`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-workspace-export-surface: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(
  "guard-workspace-export-surface: PASS (workspace exports are contract + ./settings/* + ./host/* only)"
);
