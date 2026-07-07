#!/usr/bin/env node
/**
 * PS-4 — marketing shell cross-surface nav guard (DL-05, DL-37).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHELL_PATH = path.join(REPO_ROOT, "apps/marketing/src/shell/marketing-shell.tsx");

/** @type {string[]} */
const violations = [];
const shell = fs.readFileSync(SHELL_PATH, "utf8");

if (shell.includes("FULL_LANDING_NAV_LINKS")) {
  violations.push("marketing-shell.tsx: FULL_LANDING_NAV_LINKS must be removed (use manifest nav)");
}

if (!shell.includes("primaryNavLinks")) {
  violations.push("marketing-shell.tsx: must consume primaryNavLinks prop");
}

if (/\/about|\/contact/.test(shell)) {
  violations.push("marketing-shell.tsx: hardcoded platform-mother paths in shell");
}

const layout = fs.readFileSync(path.join(REPO_ROOT, "apps/marketing/app/layout.tsx"), "utf8");
if (!layout.includes("resolveMarketingShellNavLinks")) {
  violations.push("apps/marketing/app/layout.tsx: must resolve manifest nav");
}

if (violations.length > 0) {
  console.error("guard-guest-cross-surface-nav: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-guest-cross-surface-nav: PASS");
