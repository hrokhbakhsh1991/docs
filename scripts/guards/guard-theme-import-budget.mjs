#!/usr/bin/env node
/**
 * Phase I1 — theme import performance budget guard bundle.
 * @see docs/dev/workspace-scale-hardening.mdoc
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { collectThemeLoaderViolations } from "./lib/theme-import-budget-guard.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {{ name: string; cmd: string[] }[]} */
const DELEGATED_GUARDS = [
  { name: "portal_guest_theme_loader", cmd: ["node", "scripts/guards/guard-portal-guest-theme-loader.mjs"] },
  { name: "marketing_guest_theme_loader", cmd: ["node", "scripts/guards/guard-marketing-guest-theme-loader.mjs"] },
];

/** @type {string[]} */
const violations = [];

function readRepo(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

for (const step of DELEGATED_GUARDS) {
  const result = spawnSync(step.cmd[0], step.cmd.slice(1), {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status === 0) {
    console.log(`PASS theme_import_budget/${step.name}`);
    continue;
  }
  violations.push(step.name);
  console.error(`FAIL theme_import_budget/${step.name}`);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (output) console.error(output);
}

violations.push(
  ...collectThemeLoaderViolations({
    surface: "admin",
    generated: readRepo("apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts"),
    layout: readRepo("apps/web/app/layout.tsx"),
    loaderName: "importAdminThemeForPlugin",
    layoutCallPattern: /await importAdminThemeForPlugin\(resolved\.session\.pluginId\)/,
    maxImportsPerPath: 1,
  })
);

violations.push(
  ...collectThemeLoaderViolations({
    surface: "portal",
    generated: readRepo("apps/portal/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"),
    layout: readRepo("apps/portal/app/layout.tsx"),
    loaderName: "importGuestPortalThemeForPlugin",
    layoutCallPattern: /await importGuestPortalThemeForPlugin\(bootstrap\.pluginId\)/,
    maxImportsPerPath: 2,
  })
);

violations.push(
  ...collectThemeLoaderViolations({
    surface: "marketing",
    generated: readRepo("apps/marketing/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"),
    layout: readRepo("apps/marketing/app/layout.tsx"),
    loaderName: "importGuestMarketingThemeForPlugin",
    layoutCallPattern: /await importGuestMarketingThemeForPlugin\(bootstrap\.pluginId\)/,
    maxImportsPerPath: 2,
  })
);

if (violations.length > 0) {
  console.error("guard-theme-import-budget: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-theme-import-budget: PASS");
