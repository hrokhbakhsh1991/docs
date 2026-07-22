#!/usr/bin/env node
/**
 * Phase C — platform must not branch on workspace ids in guarded surfaces.
 * C1: no workspaceType === "urban" in apps/api/src (except generated + tests).
 * C2: no pluginId === "denali" in tours/wizard-template page clients.
 * C4: no isDenaliOperatorSession / isDenali / denali imports in guarded web surfaces.
 * C3: no @app-tour/workspace-denali imports in apps/marketing/src/catalog.
 * @see docs/architecture/platform-architecture-v2.md
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

/** @param {string} dir */
function walkTsFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      files.push(...walkTsFiles(abs));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(abs);
    }
  }
  return files;
}

/** @param {string} rel */
function isApiExcluded(rel) {
  if (rel.endsWith(".generated.ts")) {
    return true;
  }
  if (rel.includes("/test/")) {
    return true;
  }
  if (rel.endsWith(".spec.ts")) {
    return true;
  }
  if (rel === "apps/api/src/tenant/resolve-workspace-type.ts") {
    return true;
  }
  return false;
}

const urbanPattern = /workspaceType\s*===\s*["']urban["']/;
const pluginIdPattern = /pluginId\s*===\s*["']denali["']/;

const API_ROOT = path.join(REPO_ROOT, "apps/api/src");
const C2_TARGETS = [
  "apps/web/app/(app)/tours/tours-page-client.tsx",
  "apps/web/app/(app)/settings/tour-wizard-template/wizard-template-client.tsx",
  "apps/web/src/tours/wizard-template-gate-logic.ts",
];

const C4_WEB_TARGETS = [
  "apps/web/app/(app)/tours/[id]/edit/tour-edit-page-client.tsx",
  "apps/web/src/wizard/wizard-field.tsx",
  "apps/web/src/features/settings/destination-form-logic.ts",
  "apps/web/src/wizard/resolve-wizard-submit-error-message.ts",
  "apps/web/src/wizard/workspace-create-tour-wizard-client.tsx",
  "apps/web/app/(app)/settings/equipment/equipment-settings-client.tsx",
  "apps/web/app/(app)/settings/locations/locations-settings-client.tsx",
  "apps/web/src/features/tours/tour-list-category-logic.ts",
  "apps/web/src/tours/wizard-template-field-display-hints.ts",
  "apps/web/src/draft/draft-unification-v3-options.ts",
  "apps/web/src/wizard/create-tour-wizard-chrome.tsx",
  "apps/web/src/components/i18n/denali-time-input.tsx",
  "apps/web/src/components/i18n/localized-datetime-picker.tsx",
  "apps/web/src/components/ui/denali-difficulty-range-slider.tsx",
  "apps/web/src/components/ui/map/denali-location-picker-map.tsx",
  "apps/web/src/components/ui/map/denali-location-picker-map-inner.tsx",
  "apps/web/src/components/ui/map/leaflet-default-icon.ts",
  "apps/web/src/bootstrap/denali-wizard-rules.ts",
  "apps/web/src/bootstrap/denali-wizard-template-preset.ts",
  "apps/web/src/wizard/use-denali-create-tour-wizard.ts",
  "apps/web/src/wizard/denali-wizard-draft-shell.ts",
  "apps/web/src/wizard/use-denali-flat-edit-page.ts",
  "apps/web/src/wizard/denali-flat-edit-form-shell.tsx",
  "apps/web/app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx",
  "apps/web/app/tours/new/denali-create-tour-wizard-client.tsx",
  "apps/web/src/bootstrap/resolve-bootstrap-workspace-plugin.ts",
  "apps/web/src/features/settings/settings-module-consistency-guard.ts",
  "apps/web/src/wizard/wizard-validation-field-label.ts",
  "apps/web/src/wizard/resolve-wizard-submit-error-message.ts",
];

const isDenaliLocalPattern = /\bisDenali\b/;
const isDenaliOperatorSessionPattern = /isDenaliOperatorSession/;
const denaliFieldIdPrefixPattern = /startsWith\(["']denali\./;
const denaliImportPattern = /@app-tour\/workspace-denali/;

for (const abs of walkTsFiles(API_ROOT)) {
  const rel = path.relative(REPO_ROOT, abs);
  if (isApiExcluded(rel)) {
    continue;
  }
  const lines = readFileSync(abs, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (urbanPattern.test(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden workspaceType urban branch — ${lines[i].trim()}`);
    }
  }
}

for (const rel of C2_TARGETS) {
  const abs = path.join(REPO_ROOT, rel);
  if (!existsSync(abs)) {
    continue;
  }
  const lines = readFileSync(abs, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (pluginIdPattern.test(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden pluginId denali branch — ${lines[i].trim()}`);
    }
  }
}

for (const rel of C4_WEB_TARGETS) {
  const abs = path.join(REPO_ROOT, rel);
  // Historical allowlist paths may have been deleted/renamed; missing files are not violations.
  if (!existsSync(abs)) {
    continue;
  }
  const lines = readFileSync(abs, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (isDenaliOperatorSessionPattern.test(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden isDenaliOperatorSession — ${lines[i].trim()}`);
    }
    if (isDenaliLocalPattern.test(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden isDenali local — ${lines[i].trim()}`);
    }
    if (denaliFieldIdPrefixPattern.test(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden denali fieldId prefix branch — ${lines[i].trim()}`);
    }
    if (denaliImportPattern.test(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden workspace-denali import — ${lines[i].trim()}`);
    }
  }
}

const MARKETING_CATALOG_ROOT = path.join(REPO_ROOT, "apps/marketing/src/catalog");

for (const abs of walkTsFiles(MARKETING_CATALOG_ROOT)) {
  const rel = path.relative(REPO_ROOT, abs);
  const lines = readFileSync(abs, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (denaliImportPattern.test(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden workspace-denali import in marketing catalog — ${lines[i].trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-no-workspace-type-branches: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-no-workspace-type-branches: PASS");
