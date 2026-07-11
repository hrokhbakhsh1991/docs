#!/usr/bin/env node
/**
 * Guard script to ban hardcoded px and opacity literals in non-generated workspace themes.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES_ROOT = path.join(REPO_ROOT, "packages/workspaces");

// Banned patterns: px values (excluding 0) and opacity decimals
const PX_RE = /\b[1-9]\d*px\b/g;
const OPACITY_RE = /opacity:\s*(0\.\d+)\b/g;

const violations = [];

// Target files that have been refactored in Phase 1 of design tokens hygiene
const TARGET_FILES = [
  "packages/workspaces/denali/theme/wizard-calendar.css",
  "packages/workspaces/denali/theme/wizard-skin.css",
  "packages/workspaces/denali/theme/wizard-review.css",
  "packages/workspaces/denali/theme/wizard-stepper.css"
];

function stripCommentsAndMediaQueries(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "") // remove comments
    .replace(/@media[^{]+\{/g, "");     // remove media query definitions
}

function auditCss(filePath, label) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  const content = stripCommentsAndMediaQueries(raw);

  const pxMatches = content.match(PX_RE) ?? [];
  const opacityMatches = content.match(OPACITY_RE) ?? [];

  for (const match of pxMatches) {
    violations.push(`${label}: hardcoded px literal found "${match}"`);
  }
  for (const match of opacityMatches) {
    violations.push(`${label}: hardcoded opacity literal found "${match}"`);
  }
}

for (const relPath of TARGET_FILES) {
  const filePath = path.join(REPO_ROOT, relPath);
  auditCss(filePath, relPath);
}

if (violations.length > 0) {
  console.error("guard-dtcg-literals-ban: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-dtcg-literals-ban: PASS");
