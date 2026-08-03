#!/usr/bin/env node
/**
 * R-10 — workspace skins must not use !important (specificity escalation).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES_THEME = path.join(REPO_ROOT, "packages/workspaces");

/** @type {string[]} */
const violations = [];

function walkCss(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      walkCss(abs);
      continue;
    }
    if (!entry.endsWith(".css")) {
      continue;
    }
    const rel = path.relative(REPO_ROOT, abs);
    if (/\/(admin-skin|wizard-|animations)\.css$/.test(rel)) {
      continue;
    }
    if (!/\/(marketing\/|urban-marketing|denali-marketing|guest-club-portal|urban-portal|denali-portal)/.test(rel)) {
      continue;
    }
    const css = readFileSync(abs, "utf8");
    if (/!important/.test(css)) {
      violations.push(`${rel} uses !important (forbidden per R-10)`);
    }
  }
}

for (const ws of readdirSync(WORKSPACES_THEME)) {
  const wsPath = path.join(WORKSPACES_THEME, ws);
  const themeDir = path.join(wsPath, "theme");
  if (!existsSync(wsPath) || !statSync(wsPath).isDirectory()) {
    continue;
  }
  if (!existsSync(themeDir) || !statSync(themeDir).isDirectory()) {
    continue;
  }
  walkCss(themeDir);
}

if (violations.length > 0) {
  console.error("guard-skin-specificity: FAIL");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-skin-specificity: PASS");
