#!/usr/bin/env node
/**
 * Denali admin ↔ portal semantic token parity on shared keys.
 * @see docs/workspaces/denali/unified-semantic-token-schema.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { composeDenaliSemanticSlices, mergeSharedLayers } from "../codegen/denali-semantic-slices.mjs";
import {
  readDenaliLightSemanticGroups,
  resolveDtcgTokenGroups,
} from "../codegen/lib/denali-dtcg-resolve.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHARED_DIR = path.join(REPO_ROOT, "packages/workspaces/denali/theme/shared");
const COMPOSE_MANIFEST = path.join(SHARED_DIR, "compose.manifest.json");
const DTCG_DIR = path.join(REPO_ROOT, "packages/design-tokens/dtcg/workspaces");

/** Shared semantic keys that must match across admin (light) and portal slices. */
export const DENALI_SHARED_PARITY_COLOR_KEYS = [
  "primary",
  "primary-hover",
  "primary-fg",
  "bg-page",
  "bg-surface",
  "bg-muted",
  "text-primary",
  "text-secondary",
  "text-muted",
  "text-link",
  "border-default",
  "border-subtle",
  "focus-ring",
];

export const DENALI_SHARED_PARITY_FLAT_KEYS = [
  "destructive",
  "destructive-foreground",
  "radius",
];

/** Admin flat.accent is the workspace accent contract (--ws-color-accent). */
export const DENALI_SHARED_PARITY_ACCENT_ADMIN_KEY = "flat.accent";

/**
 * @param {Record<string, string>} resolved
 * @param {"color" | "flat"} group
 * @param {string} key
 */
function readResolved(resolved, group, key) {
  return resolved[`${group}.${key}`];
}

/**
 * @param {Record<string, unknown>} groups
 */
function resolvedFromGroups(groups) {
  return resolveDtcgTokenGroups(groups);
}

/**
 * @param {Record<string, unknown>} slice
 */
function resolvedFromAdminLightSlice(slice) {
  const block = readDenaliLightSemanticGroups(slice, 0);
  return resolvedFromGroups(block);
}

/**
 * @param {Record<string, unknown>} slice
 */
function resolvedFromPortalSlice(slice) {
  return resolvedFromGroups(slice);
}

/**
 * @param {Record<string, string>} adminResolved
 * @param {Record<string, string>} portalResolved
 */
export function compareDenaliSharedParity(adminResolved, portalResolved) {
  /** @type {string[]} */
  const failures = [];

  for (const key of DENALI_SHARED_PARITY_COLOR_KEYS) {
    const adminValue = readResolved(adminResolved, "color", key);
    const portalValue = readResolved(portalResolved, "color", key);
    if (adminValue === undefined || portalValue === undefined) {
      failures.push(`missing shared color.${key} (admin=${adminValue ?? "∅"}, portal=${portalValue ?? "∅"})`);
      continue;
    }
    if (adminValue !== portalValue) {
      failures.push(`color.${key}: admin=${adminValue} portal=${portalValue}`);
    }
  }

  for (const key of DENALI_SHARED_PARITY_FLAT_KEYS) {
    const adminValue = readResolved(adminResolved, "flat", key);
    const portalValue = readResolved(portalResolved, "flat", key);
    if (adminValue === undefined || portalValue === undefined) {
      failures.push(`missing shared flat.${key} (admin=${adminValue ?? "∅"}, portal=${portalValue ?? "∅"})`);
      continue;
    }
    if (adminValue !== portalValue) {
      failures.push(`flat.${key}: admin=${adminValue} portal=${portalValue}`);
    }
  }

  const adminAccent = adminResolved[DENALI_SHARED_PARITY_ACCENT_ADMIN_KEY];
  const portalAccent = readResolved(portalResolved, "color", "accent");
  if (portalAccent !== undefined && adminAccent !== undefined && adminAccent !== portalAccent) {
    failures.push(`accent: admin flat.accent=${adminAccent} portal color.accent=${portalAccent}`);
  }

  return failures;
}

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(DTCG_DIR, relPath), "utf8"));
}

function main() {
  const adminSlice = loadJson("denali.admin.tokens.json");
  const portalSlice = loadJson("denali.portal.tokens.json");

  const failures = compareDenaliSharedParity(
    resolvedFromAdminLightSlice(adminSlice),
    resolvedFromPortalSlice(portalSlice),
  );

  const manifest = JSON.parse(fs.readFileSync(COMPOSE_MANIFEST, "utf8"));
  const composed = composeDenaliSemanticSlices(manifest);
  const composedAdmin = JSON.parse(composed["denali.admin.tokens.json"]);
  const composedPortal = JSON.parse(composed["denali.portal.tokens.json"]);
  const composedFailures = compareDenaliSharedParity(
    resolvedFromAdminLightSlice(composedAdmin),
    resolvedFromPortalSlice(composedPortal),
  );

  if (composedFailures.length > 0) {
    console.error("guard-token-parity: composed shared sources diverge (compose.manifest.json bug)");
    for (const failure of composedFailures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  const sharedContract = resolveDtcgTokenGroups(
    mergeSharedLayers(["palette.json", "semantics.light.json"]),
  );
  for (const key of DENALI_SHARED_PARITY_COLOR_KEYS) {
    const contractValue = readResolved(sharedContract, "color", key);
    const portalValue = readResolved(resolvedFromPortalSlice(portalSlice), "color", key);
    if (contractValue !== portalValue) {
      failures.push(`portal drift from shared contract color.${key}: contract=${contractValue} portal=${portalValue}`);
    }
  }

  if (failures.length > 0) {
    console.error("guard-token-parity: FAIL");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    console.error("hint: run pnpm run generate:denali-semantic-slices && pnpm --filter @app-tour/design-tokens run build");
    process.exit(1);
  }

  console.log("guard-token-parity: PASS (denali admin ↔ portal shared semantics)");
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main();
}
