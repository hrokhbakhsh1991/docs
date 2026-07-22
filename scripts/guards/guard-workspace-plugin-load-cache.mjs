#!/usr/bin/env node
/**
 * Phase I2 — workspace plugin load cache policy guard.
 * @see docs/dev/workspace-scale-hardening.mdoc
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { productWorkspaceManifests } from "../codegen/workspace-registry/domains/core-registry.mjs";
import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import { collectWorkspacePluginLoadCacheViolations } from "./lib/workspace-plugin-load-cache-guard.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATED = path.join(
  REPO_ROOT,
  "apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts"
);
const POLICY = path.join(REPO_ROOT, "apps/web/src/bootstrap/workspace-plugin-load-cache.ts");

const product = productWorkspaceManifests(discoverManifests());
const sortedIds = product.map((m) => m.id).sort();
const expectedRevision = sortedIds.join(",");
const expectedMaxEntries = sortedIds.length;

const generated = readFileSync(GENERATED, "utf8");
const policy = readFileSync(POLICY, "utf8");

/** @type {string[]} */
const violations = collectWorkspacePluginLoadCacheViolations(
  generated,
  expectedMaxEntries,
  expectedRevision
);

if (!policy.includes("getOrCreateWorkspacePluginLoad")) {
  violations.push("workspace-plugin-load-cache.ts must export getOrCreateWorkspacePluginLoad");
}
if (!policy.includes("invalidateWorkspacePluginLoadCache")) {
  violations.push("workspace-plugin-load-cache.ts must export invalidateWorkspacePluginLoadCache");
}

if (violations.length > 0) {
  console.error("guard-workspace-plugin-load-cache: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-workspace-plugin-load-cache: PASS");
