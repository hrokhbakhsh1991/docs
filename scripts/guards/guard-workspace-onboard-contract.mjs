#!/usr/bin/env node
/**
 * Every workspace manifest must appear in generated API plugin registry.
 * @see docs/dev/workspace-registry-codegen-modularization.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverManifests } from "../generate-workspace-registry.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATED_REGISTRY = path.join(
  REPO_ROOT,
  "apps/api/src/workspace/workspace-plugin-registry.generated.ts"
);

/** @type {string[]} */
const violations = [];

if (!fs.existsSync(GENERATED_REGISTRY)) {
  console.error("guard-workspace-onboard-contract: FAIL — generated registry missing");
  process.exit(1);
}

const generatedSource = fs.readFileSync(GENERATED_REGISTRY, "utf8");
const manifests = discoverManifests();
const manifestIds = manifests.map((manifest) => manifest.id).sort();

/** @type {Set<string>} */
const registeredIds = new Set();
for (const match of generatedSource.matchAll(/get([A-Za-z0-9]+)WorkspacePlugin/g)) {
  const pascal = match[1];
  const kebab = pascal
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  registeredIds.add(kebab);
}

for (const manifest of manifests) {
  if (!registeredIds.has(manifest.id)) {
    violations.push(
      `${manifest.id}: manifest present but missing from workspace-plugin-registry.generated.ts`
    );
  }
}

for (const registeredId of registeredIds) {
  if (!manifestIds.includes(registeredId)) {
    violations.push(
      `${registeredId}: in generated registry but no workspace.manifest.json on disk`
    );
  }
}

if (violations.length > 0) {
  console.error("guard-workspace-onboard-contract: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(`guard-workspace-onboard-contract: PASS (${manifestIds.length} workspaces)`);
