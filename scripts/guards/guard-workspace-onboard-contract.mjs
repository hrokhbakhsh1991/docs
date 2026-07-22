#!/usr/bin/env node
/**
 * Every workspace manifest must appear in generated API plugin registry.
 * @see docs/dev/workspace-registry-codegen-modularization.mdoc
 * @see docs/dev/saas-platform-remediation.mdoc (Gap Closure E.4a)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { productWorkspaceManifests } from "../codegen/workspace-registry/domains/core-registry.mjs";
import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import { evaluateWorkspaceOnboardContract } from "../codegen/workspace-registry/onboard-contract.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATED_REGISTRY = path.join(
  REPO_ROOT,
  "apps/api/src/workspace/workspace-plugin-registry.generated.ts"
);

if (!fs.existsSync(GENERATED_REGISTRY)) {
  console.error("guard-workspace-onboard-contract: FAIL — generated registry missing");
  process.exit(1);
}

const generatedSource = fs.readFileSync(GENERATED_REGISTRY, "utf8");
const manifests = productWorkspaceManifests(discoverManifests());
const result = evaluateWorkspaceOnboardContract(manifests, generatedSource);

if (!result.ok) {
  console.error("guard-workspace-onboard-contract: FAIL");
  for (const violation of result.violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(`guard-workspace-onboard-contract: PASS (${result.manifestIds.length} workspaces)`);
