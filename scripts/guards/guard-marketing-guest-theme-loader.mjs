#!/usr/bin/env node
/**
 * MKT-7 — marketing bootstrap must use per-plugin dynamic skin loader (no eager imports).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BOOTSTRAP = path.join(
  REPO_ROOT,
  "apps/marketing/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"
);
const LAYOUT = path.join(REPO_ROOT, "apps/marketing/app/layout.tsx");

/** @type {string[]} */
const violations = [];

const generated = readFileSync(BOOTSTRAP, "utf8");
const layout = readFileSync(LAYOUT, "utf8");

if (/^import ["']@app-tour\/workspace-/m.test(generated)) {
  violations.push("marketing bootstrap must not eager-import all workspace skins");
}
if (!generated.includes("importGuestMarketingThemeForPlugin")) {
  violations.push("marketing bootstrap must export importGuestMarketingThemeForPlugin");
}
if (!layout.includes("await importGuestMarketingThemeForPlugin(bootstrap.pluginId)")) {
  violations.push("marketing layout must load skin for active pluginId only");
}
if (/import ["']@\/bootstrap\/workspace-guest-theme-stylesheets\.generated["'];\s*$/m.test(layout)) {
  violations.push("marketing layout must not side-effect import workspace-guest-theme-stylesheets");
}

if (violations.length > 0) {
  console.error("guard-marketing-guest-theme-loader: FAIL");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("guard-marketing-guest-theme-loader: PASS");
