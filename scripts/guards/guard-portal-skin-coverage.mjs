#!/usr/bin/env node
/**
 * PTL-8c — every manifest workspace with portal guestThemeStylesheets has a scoped skin stub.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES = path.join(REPO_ROOT, "packages/workspaces");

/** @type {string[]} */
const violations = [];

for (const id of readdirSync(WORKSPACES)) {
  const manifestPath = path.join(WORKSPACES, id, "workspace.manifest.json");
  if (!existsSync(manifestPath)) {
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const portalSkins = manifest.guestThemeStylesheets?.portal;
  if (!Array.isArray(portalSkins) || portalSkins.length === 0) {
    continue;
  }

  for (const relativeSkin of portalSkins) {
    const skinPath = path.join(WORKSPACES, id, relativeSkin);
    if (!existsSync(skinPath)) {
      violations.push(`${id}: missing portal skin file ${relativeSkin}`);
      continue;
    }
    const css = readFileSync(skinPath, "utf8");
    const scope = `body[data-app-surface="portal"][data-workspace-plugin="${manifest.id}"]`;
    if (!css.includes(scope)) {
      violations.push(`${id}: ${relativeSkin} must include scoped selector ${scope}`);
    }
    if (!css.includes("[data-portal-shell]") && !css.includes("data-portal-shell")) {
      violations.push(`${id}: ${relativeSkin} must target portal shell chrome ([data-portal-shell])`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-portal-skin-coverage: FAIL");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("guard-portal-skin-coverage: PASS");
