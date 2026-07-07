#!/usr/bin/env node
/**
 * PF-4.4 / Z09 — guest fail-closed errors expose stable structured codes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {{ rel: string; className: string; code: string }[]} */
const EXPECTED = [
  {
    rel: "packages/workspace-sdk/src/catalog/resolve-catalog-api-path.ts",
    className: "UnknownCatalogPluginError",
    code: "UNKNOWN_CATALOG_PLUGIN",
  },
  {
    rel: "packages/workspace-sdk/src/catalog/resolve-catalog-list-features.ts",
    className: "UnknownCatalogPresentationPluginError",
    code: "GUEST_CATALOG_PRESENTATION_NOT_CONFIGURED",
  },
  {
    rel: "packages/guest-surface-host/src/resolve-dev-plugin-id.ts",
    className: "DevPluginIdUnresolvedError",
    code: "DEV_PLUGIN_ID_UNRESOLVED",
  },
  {
    rel: "packages/workspace-sdk/src/profile/resolve-member-profile-capabilities.ts",
    className: "MemberProfileNotConfiguredError",
    code: "MEMBER_PROFILE_NOT_CONFIGURED",
  },
  {
    rel: "packages/workspace-sdk/src/catalog/resolve-guest-conformance-level.ts",
    className: "GuestConformanceNotConfiguredError",
    code: "GUEST_CONFORMANCE_NOT_CONFIGURED",
  },
];

/** @type {string[]} */
const violations = [];

for (const entry of EXPECTED) {
  const abs = path.join(REPO_ROOT, entry.rel);
  const source = fs.readFileSync(abs, "utf8");
  if (!source.includes(`class ${entry.className}`)) {
    violations.push(`${entry.rel}: missing ${entry.className}`);
    continue;
  }
  if (!source.includes(`readonly code = "${entry.code}"`)) {
    violations.push(`${entry.rel}: ${entry.className} must expose code ${entry.code}`);
  }
}

if (violations.length > 0) {
  console.error("guard-structured-errors: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-structured-errors: PASS");
