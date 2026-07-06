#!/usr/bin/env node
/**
 * Member portal contract guard — manifest availability ↔ generated contracts.
 * @see docs/phase-19/member-portal-shell/member-portal-registry-schema.mdoc
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertMemberPortalL4ReferenceWorkspaces,
  discoverManifests,
  normalizeMemberPortalAvailability,
  resolveEffectiveMemberPortalConfig,
} from "../generate-workspace-registry.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

const registryCheck = spawnSync("node", ["scripts/generate-workspace-registry.mjs", "--check"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  stdio: "pipe",
});
if (registryCheck.status !== 0) {
  violations.push("generate:workspace-registry --check failed (stale member portal contracts?)");
}

const manifests = discoverManifests();
try {
  assertMemberPortalL4ReferenceWorkspaces(manifests);
} catch (error) {
  violations.push(error instanceof Error ? error.message : String(error));
}

for (const manifest of manifests) {
  const availability = normalizeMemberPortalAvailability(manifest);
  const config = resolveEffectiveMemberPortalConfig(manifest);
  if (config.availability !== availability) {
    violations.push(`${manifest.id}: contract config availability mismatch`);
  }
  if (manifest.guestConformance?.memberApp === true && availability === "off") {
    violations.push(`${manifest.id}: guestConformance.memberApp conflicts with availability off`);
  }
}

if (violations.length > 0) {
  console.error("guard-member-portal-contract: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log(`guard-member-portal-contract: PASS (${manifests.length} manifest(s))`);
