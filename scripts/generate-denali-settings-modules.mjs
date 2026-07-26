#!/usr/bin/env node
/**
 * Phase 3c — verify Denali owns required settings module ids (no apps/web emit).
 *
 * Run:  pnpm run generate:denali-settings-modules
 * Check: pnpm run generate:denali-settings-modules --check
 *
 * Both modes are verification-only (historical name retained for Phase 10 contracts).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(
  REPO_ROOT,
  "packages/workspaces/denali/src/settings/denali-settings.manifest.ts",
);
const FALLBACK_PATH = join(
  REPO_ROOT,
  "packages/workspaces/denali/src/settings/denali-fallback-settings-modules.ts",
);
const SHELL_EMIT_PATH = join(
  REPO_ROOT,
  "apps/web/src/features/settings/denali-required-settings-modules.generated.ts",
);
const SHELL_BINDER_PATH = join(
  REPO_ROOT,
  "apps/web/src/bootstrap/workspace-settings-hub-fallback-bindings.generated.ts",
);

function extractDenaliSettingsModuleIds(manifestSource) {
  const match = manifestSource.match(
    /const DENALI_SETTINGS_MODULES = Object\.freeze\(\[([\s\S]*?)\]\s*as const/,
  );
  if (match === null) {
    throw new Error(`${MANIFEST_PATH}: DENALI_SETTINGS_MODULES block not found`);
  }
  const ids = [...match[1].matchAll(/\bid:\s*"([^"]+)"/g)].map((entry) => entry[1]);
  if (ids.length === 0) {
    throw new Error(`${MANIFEST_PATH}: no settings module ids extracted`);
  }
  return ids;
}

function main() {
  const failures = [];
  const manifestSource = readFileSync(MANIFEST_PATH, "utf8");
  const moduleIds = extractDenaliSettingsModuleIds(manifestSource);

  if (!manifestSource.includes("export const DENALI_BACKEND_REQUIRED_MODULE_IDS")) {
    failures.push(
      `${MANIFEST_PATH}: must export DENALI_BACKEND_REQUIRED_MODULE_IDS (Phase 3c package ownership)`,
    );
  }
  if (!manifestSource.includes("DENALI_SETTINGS_MODULES.map")) {
    failures.push(
      `${MANIFEST_PATH}: DENALI_BACKEND_REQUIRED_MODULE_IDS must derive from DENALI_SETTINGS_MODULES`,
    );
  }

  const fallbackSource = readFileSync(FALLBACK_PATH, "utf8");
  if (
    !fallbackSource.includes("DENALI_BACKEND_REQUIRED_MODULE_IDS") ||
    !fallbackSource.includes("denali-settings.manifest")
  ) {
    failures.push(
      `${FALLBACK_PATH}: must re-export DENALI_BACKEND_REQUIRED_MODULE_IDS from settings manifest`,
    );
  }

  if (existsSync(SHELL_EMIT_PATH)) {
    failures.push(
      `forbidden shell emit still present: ${SHELL_EMIT_PATH} (delete; ids live on Denali package)`,
    );
  }

  if (existsSync(SHELL_BINDER_PATH)) {
    const binder = readFileSync(SHELL_BINDER_PATH, "utf8");
    if (binder.includes("denali-required-settings-modules.generated")) {
      failures.push(
        `${SHELL_BINDER_PATH}: must not statically import denali-required-settings-modules.generated`,
      );
    }
    if (!binder.includes("mod.DENALI_BACKEND_REQUIRED_MODULE_IDS")) {
      failures.push(
        `${SHELL_BINDER_PATH}: must read requiredModuleIds from dynamic fallback-modules import`,
      );
    }
  }

  if (failures.length > 0) {
    console.error("generate:denali-settings-modules: FAIL");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  const mode = process.argv.includes("--check") ? "--check" : "verify";
  console.log(
    `generate:denali-settings-modules ${mode}: PASS (${moduleIds.length} module ids; package-owned; no apps/web emit)`,
  );
}

main();
