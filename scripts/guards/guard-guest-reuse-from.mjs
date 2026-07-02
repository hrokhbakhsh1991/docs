#!/usr/bin/env node
/**
 * PF-4.6 / Z12 — compose-mode registration flow must declare valid reuse source.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverManifests } from "../generate-workspace-registry.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES_DIR = path.join(REPO_ROOT, "packages/workspaces");

/** @type {string[]} */
const violations = [];

const manifests = discoverManifests(WORKSPACES_DIR);
const ids = new Set(manifests.map((m) => m.id));

for (const manifest of manifests) {
  const steps = manifest.catalogRegistrationFlow?.steps;
  if (steps?.mode !== "compose") {
    continue;
  }
  const authSource = steps.reuseAuthStepsFrom ?? steps.reuseFrom;
  if (typeof authSource !== "string" || authSource.length === 0) {
    violations.push(`${manifest.id}: compose mode missing reuseAuthStepsFrom/reuseFrom`);
    continue;
  }
  if (authSource === "shared") {
    continue;
  }
  if (!ids.has(authSource)) {
    violations.push(`${manifest.id}: reuse source "${authSource}" is not a known workspace id`);
  }
}

if (violations.length > 0) {
  console.error("guard-guest-reuse-from: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-guest-reuse-from: PASS");
