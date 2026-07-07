#!/usr/bin/env node
/**
 * Manifest-driven workspace plugin entry export surface (all workspaces).
 * @see docs/dev/denali-plugin-encapsulation.mdoc
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import { auditWorkspacePluginSurface } from "./lib/plugin-surface-guard.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

for (const manifest of discoverManifests()) {
  const { violations: manifestViolations } = auditWorkspacePluginSurface(REPO_ROOT, manifest);
  violations.push(...manifestViolations);
}

if (violations.length > 0) {
  console.error("guard-workspace-plugin-surface: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard-workspace-plugin-surface: PASS");
