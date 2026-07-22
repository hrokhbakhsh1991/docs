#!/usr/bin/env node
/**
 * PTL-THEME-01 / INV-S01 — portal bootstrap must load skin per active pluginId only.
 * Detects R-01 (eager denali-portal.css bleed).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BOOTSTRAP = path.join(
  REPO_ROOT,
  "packages/guest-workspace-runtime/src/workspace-guest-theme-stylesheets.portal.generated.ts"
);
const LAYOUT = path.join(REPO_ROOT, "apps/portal/app/layout.tsx");

/** @type {string[]} */
const violations = [];

const generated = readFileSync(BOOTSTRAP, "utf8");
const layout = readFileSync(LAYOUT, "utf8");

if (/^import ["']@app-tour\/workspace-/m.test(generated)) {
  violations.push("portal bootstrap must not eager-import workspace skins (R-01)");
}
if (!generated.includes("importGuestPortalThemeForPlugin")) {
  violations.push("portal bootstrap must export importGuestPortalThemeForPlugin (PTL-7)");
}
if (!generated.includes("WORKSPACE_GUEST_PORTAL_DEFAULT_SKIN")) {
  violations.push("portal bootstrap must export WORKSPACE_GUEST_PORTAL_DEFAULT_SKIN (Phase D.2)");
}
if (!layout.includes("await importGuestPortalThemeForPlugin(bootstrap.pluginId)")) {
  violations.push("portal layout must load skin for active pluginId only (R-01)");
}
if (/import ["']@\/bootstrap\/workspace-guest-theme-stylesheets\.generated["'];\s*$/m.test(layout)) {
  violations.push("portal layout must not side-effect import workspace-guest-theme-stylesheets");
}

if (violations.length > 0) {
  console.error("guard-portal-guest-theme-loader: BLOCKED R-01");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-portal-guest-theme-loader: PASS");
