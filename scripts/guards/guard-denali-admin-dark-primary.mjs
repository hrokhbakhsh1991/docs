#!/usr/bin/env node
/**
 * F9-2 — Denali admin dark primary must not leak platform blue (#5b9fd4).
 * @see docs/dev/dtcg-pipeline-spec.mdoc § F9
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const DENALI_ADMIN_SEMANTIC = path.join(
  REPO_ROOT,
  "packages/workspaces/denali/theme/admin-semantic-tokens.css",
);
const PLATFORM_DARK_THEME = path.join(REPO_ROOT, "packages/design-tokens/src/themes/dark.css");
const DENALI_ADMIN_DTCG = path.join(
  REPO_ROOT,
  "packages/design-tokens/dtcg/workspaces/denali.admin.tokens.json",
);

const DENALI_DARK_PRIMARY = "#5eead4";
const PLATFORM_DARK_PRIMARY = "#5b9fd4";

/** @type {string[]} */
const violations = [];

const semantic = readFileSync(DENALI_ADMIN_SEMANTIC, "utf8");
const platformDark = readFileSync(PLATFORM_DARK_THEME, "utf8");
const adminSlice = JSON.parse(readFileSync(DENALI_ADMIN_DTCG, "utf8"));

if (!semantic.includes(`--color-primary: ${DENALI_DARK_PRIMARY}`)) {
  violations.push(
    `admin-semantic-tokens.css: missing dark --color-primary: ${DENALI_DARK_PRIMARY}`,
  );
}

if (semantic.includes(PLATFORM_DARK_PRIMARY)) {
  violations.push(
    `admin-semantic-tokens.css: must not contain platform dark primary ${PLATFORM_DARK_PRIMARY}`,
  );
}

if (!semantic.includes('body[data-workspace-plugin="denali"] .theme-dark')) {
  violations.push(
    'admin-semantic-tokens.css: missing triple-cascade arm body[data-workspace-plugin="denali"] .theme-dark',
  );
}

if (!platformDark.includes(`--color-primary: ${PLATFORM_DARK_PRIMARY}`)) {
  violations.push(
    `themes/dark.css: expected platform dark primary ${PLATFORM_DARK_PRIMARY} (separate platform contract)`,
  );
}

const darkBlock = adminSlice.blocks?.[1];
if (!darkBlock || darkBlock.color?.primary?.$value !== DENALI_DARK_PRIMARY) {
  violations.push(
    `denali.admin.tokens.json: dark block color.primary must be ${DENALI_DARK_PRIMARY}`,
  );
}

if (violations.length > 0) {
  console.error("guard-denali-admin-dark-primary: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log(
  `guard-denali-admin-dark-primary: PASS (Denali dark ${DENALI_DARK_PRIMARY}, platform ${PLATFORM_DARK_PRIMARY} isolated)`,
);
