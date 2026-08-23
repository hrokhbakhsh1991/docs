#!/usr/bin/env node
/**
 * Phase C — platform must not branch on workspace ids in guarded surfaces.
 * C1: no workspaceType === "<workspace-id>" in apps/api/src (except generated + tests).
 * C2: no pluginId === "<workspace-id>" in tours/wizard-template page clients.
 * C3/C4: no product-local shims/imports in guarded shell/catalog surfaces.
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
  return false;
}

const WORKSPACE_ID_LITERAL = String.raw`["'](?!(?:string|number|boolean|object|undefined|function|symbol|bigint|unknown|platform)["'])[a-z][a-z0-9-]*["']`;
const WORKSPACE_TYPE_BRANCH_PATTERN = new RegExp(
  String.raw`\bworkspaceType\s*(?:={2,3}|!={1,2})\s*${WORKSPACE_ID_LITERAL}|${WORKSPACE_ID_LITERAL}\s*(?:={2,3}|!={1,2})\s*\bworkspaceType\b`
);
const PLUGIN_ID_BRANCH_PATTERN = new RegExp(
  String.raw`\bpluginId\s*(?:={2,3}|!={1,2})\s*${WORKSPACE_ID_LITERAL}|${WORKSPACE_ID_LITERAL}\s*(?:={2,3}|!={1,2})\s*\bpluginId\b`
);
const OPERATOR_IRR_TOMAN_PLUGIN_IDS_PATTERN =
  /\bOPERATOR_IRR_TOMAN_PLUGIN_IDS\b/;
const PLUGIN_ID_DENALI_IRR_PATTERN =
  /\bpluginId\s*(?:={2,3}|!={1,2})\s*["']denali["'].*\bIRR\b|\bIRR\b.*\bpluginId\s*(?:={2,3}|!={1,2})\s*["']denali["']/;
const WORKSPACE_TYPE_FALLBACK_PATTERN = new RegExp(
  String.raw`\bworkspaceType\b\s*(?:\?\?|\|\|)\s*${WORKSPACE_ID_LITERAL}|\bworkspaceType\b\s*=\s*[\s\S]{0,180}\?\s*[\s\S]{0,180}:\s*${WORKSPACE_ID_LITERAL}`
);
const PLUGIN_ID_FALLBACK_PATTERN = new RegExp(
  String.raw`\bpluginId\b\s*(?:\?\?|\|\|)\s*${WORKSPACE_ID_LITERAL}|\bpluginId\b\s*=\s*[\s\S]{0,180}\?\s*[\s\S]{0,180}:\s*${WORKSPACE_ID_LITERAL}`
);

/** @param {string} line */
export function hasWorkspaceTypeBranch(line) {
  return WORKSPACE_TYPE_BRANCH_PATTERN.test(line);
}

/** @param {string} line */
export function hasPluginIdBranch(line) {
  return PLUGIN_ID_BRANCH_PATTERN.test(line);
}

/** @param {string} line */
export function hasWorkspaceTypeFallback(line) {
  return WORKSPACE_TYPE_FALLBACK_PATTERN.test(line);
}

/** @param {string} line */
export function hasPluginIdFallback(line) {
  return PLUGIN_ID_FALLBACK_PATTERN.test(line);
}

/** CW3-09 — publish wire-label heuristics in neutral canonical host code. */
const CANONICAL_PUBLISH_LABEL_SINGLE_PATTERN =
  /\b(?:label|status|publishStatus)\s*(?:={2,3}|!={1,2})\s*["'](?:published|active)["']/;
const CANONICAL_PUBLISH_LABEL_COMBINED_PATTERN =
  /\b(?:label|status|publishStatus)\s*===\s*["']published["']\s*\|\|\s*(?:label|status|publishStatus)\s*===\s*["']active["']/;

/** @param {string} line */
export function hasCanonicalPublishLabelHeuristic(line) {
  return (
    CANONICAL_PUBLISH_LABEL_SINGLE_PATTERN.test(line) ||
    CANONICAL_PUBLISH_LABEL_COMBINED_PATTERN.test(line)
  );
}

/** @param {string} rel */
function isCanonicalPublishLabelHeuristicExcluded(rel) {
  if (rel.endsWith(".generated.ts")) {
    return true;
  }
  if (rel === "apps/api/src/canonical/publish-lifecycle-label-compat.ts") {
    return true;
  }
  if (rel === "apps/api/src/canonical/workspace-publish-label-mapping-dispatch.ts") {
    return true;
  }
  return false;
}

const API_ROOT = path.join(REPO_ROOT, "apps/api/src");
const CANONICAL_ROOT = path.join(API_ROOT, "canonical");
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
    if (hasWorkspaceTypeBranch(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden workspaceType branch — ${lines[i].trim()}`);
    }
    if (hasWorkspaceTypeFallback(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden workspaceType fallback — ${lines[i].trim()}`);
    }
  }
}

for (const abs of walkTsFiles(CANONICAL_ROOT)) {
  const rel = path.relative(REPO_ROOT, abs);
  if (isApiExcluded(rel) || isCanonicalPublishLabelHeuristicExcluded(rel)) {
    continue;
  }
  const lines = readFileSync(abs, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (hasCanonicalPublishLabelHeuristic(lines[i])) {
      violations.push(
        `${rel}:${i + 1}: forbidden publish-label heuristic — ${lines[i].trim()}`
      );
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
    if (hasPluginIdBranch(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden pluginId branch — ${lines[i].trim()}`);
    }
    if (hasPluginIdFallback(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden pluginId fallback — ${lines[i].trim()}`);
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
      violations.push(
        `${rel}:${i + 1}: forbidden denali fieldId prefix branch — ${lines[i].trim()}`
      );
    }
    if (denaliImportPattern.test(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden workspace-denali import — ${lines[i].trim()}`);
    }
  }
}

const MARKETING_CATALOG_ROOT = path.join(REPO_ROOT, "apps/marketing/src/catalog");
const WEB_TOUR_FORMATTERS = path.join(
  REPO_ROOT,
  "apps/web/src/features/tours/tour-list-formatters.ts"
);

for (const abs of walkTsFiles(MARKETING_CATALOG_ROOT)) {
  const rel = path.relative(REPO_ROOT, abs);
  const lines = readFileSync(abs, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (denaliImportPattern.test(lines[i])) {
      violations.push(
        `${rel}:${i + 1}: forbidden workspace-denali import in marketing catalog — ${lines[i].trim()}`
      );
    }
    if (hasPluginIdBranch(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden pluginId branch — ${lines[i].trim()}`);
    }
    if (PLUGIN_ID_DENALI_IRR_PATTERN.test(lines[i])) {
      violations.push(
        `${rel}:${i + 1}: forbidden pluginId+IRR currency branch — ${lines[i].trim()}`
      );
    }
  }
}

if (existsSync(WEB_TOUR_FORMATTERS)) {
  const rel = path.relative(REPO_ROOT, WEB_TOUR_FORMATTERS);
  const lines = readFileSync(WEB_TOUR_FORMATTERS, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (OPERATOR_IRR_TOMAN_PLUGIN_IDS_PATTERN.test(lines[i])) {
      violations.push(
        `${rel}:${i + 1}: forbidden OPERATOR_IRR_TOMAN_PLUGIN_IDS — ${lines[i].trim()}`
      );
    }
    if (hasPluginIdBranch(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden pluginId branch — ${lines[i].trim()}`);
    }
    if (PLUGIN_ID_DENALI_IRR_PATTERN.test(lines[i])) {
      violations.push(
        `${rel}:${i + 1}: forbidden pluginId+IRR currency branch — ${lines[i].trim()}`
      );
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
