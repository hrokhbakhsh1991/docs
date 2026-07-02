#!/usr/bin/env node
/**
 * SEO-2 / SEO-5 — L2+ guest workspaces must declare guestSeo and export JSON-LD builders.
 * @see docs/dev/adr-guest-plugin/ADR-GP-004-guest-seo-manifest.md
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertGuestSeoManifest,
  discoverManifests,
  resolveGuestConformanceLevel,
} from "../generate-workspace-registry.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

/**
 * @param {string} workspaceId
 * @param {string} builderExport
 */
function workspaceExportsJsonLdBuilder(workspaceId, builderExport) {
  const catalogDir = path.join(REPO_ROOT, "packages/workspaces", workspaceId, "src/catalog");
  if (!fs.existsSync(catalogDir)) {
    return false;
  }
  const pattern = new RegExp(`export function ${builderExport}\\b`);
  for (const fileName of fs.readdirSync(catalogDir)) {
    if (!fileName.endsWith(".ts")) {
      continue;
    }
    const source = fs.readFileSync(path.join(catalogDir, fileName), "utf8");
    if (pattern.test(source)) {
      return true;
    }
  }
  return false;
}

for (const manifest of discoverManifests()) {
  const level = resolveGuestConformanceLevel(manifest);
  if (level === "L0" || level === "L1") {
    continue;
  }

  if (manifest.guestSeo === undefined) {
    violations.push(`${manifest.id}: guestSeo is required for conformance ${level}`);
    continue;
  }

  try {
    assertGuestSeoManifest(manifest);
  } catch (error) {
    violations.push(error instanceof Error ? error.message : String(error));
    continue;
  }

  const jsonLd = manifest.guestSeo.marketing.jsonLd;
  if (jsonLd.required !== true) {
    violations.push(`${manifest.id}: guestSeo.marketing.jsonLd.required must be true for ${level}`);
  }

  if (!workspaceExportsJsonLdBuilder(manifest.id, jsonLd.builderExport)) {
    violations.push(
      `${manifest.id}: guestSeo.marketing.jsonLd.builderExport "${jsonLd.builderExport}" not found in src/catalog`
    );
  }
}

if (violations.length > 0) {
  console.error("guard-guest-seo: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

const validator = spawnSync(
  process.execPath,
  [path.join(REPO_ROOT, "scripts/validate-json-ld.mjs"), "--all-fixtures"],
  { cwd: REPO_ROOT, encoding: "utf8" }
);
if (validator.status !== 0) {
  console.error("guard-guest-seo: FAIL (validate-json-ld)");
  if (validator.stdout?.trim()) {
    console.error(validator.stdout.trim());
  }
  if (validator.stderr?.trim()) {
    console.error(validator.stderr.trim());
  }
  process.exit(1);
}

console.log("guard-guest-seo: PASS");
