#!/usr/bin/env node
/**
 * Phase H3 — workspace production certification guard (CERT-04 + proof matrix).
 * @see docs/dev/workspace-certification.mdoc
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverManifests, resolveProductionCertificationTier } from "../generate-workspace-registry.mjs";
import {
  collectCertificationViolations,
  parseProductionCertificationFromGenerated,
  parseProofMatrixYaml,
} from "./lib/workspace-certification-guard.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATED_PATH = path.join(
  REPO_ROOT,
  "packages/workspace-sdk/src/catalog/workspace-production-certification.generated.ts"
);
const PROOF_MATRIX_PATH = path.join(REPO_ROOT, "docs/dev/workspace-certification-proof-matrix.yaml");
const E2E_HOOKS_PATH = path.join(REPO_ROOT, "docs/dev/guest-registration-e2e-hooks.yaml");

/** @type {string[]} */
const violations = [];

function fail(message) {
  violations.push(message);
  console.error(`FAIL workspace_certification/${message}`);
}

function pass(name) {
  console.log(`PASS workspace_certification/${name}`);
}

if (!fs.existsSync(PROOF_MATRIX_PATH)) {
  console.error("guard-workspace-certification: FAIL — proof matrix YAML missing");
  process.exit(1);
}

if (!fs.existsSync(GENERATED_PATH)) {
  console.error("guard-workspace-certification: FAIL — generated certification registry missing");
  process.exit(1);
}

const manifests = discoverManifests();
/** @type {Record<string, "stub" | "certified">} */
const manifestTiers = {};
for (const manifest of manifests) {
  manifestTiers[manifest.id] = resolveProductionCertificationTier(manifest);
}

const generatedSource = fs.readFileSync(GENERATED_PATH, "utf8");
const generatedTiers = parseProductionCertificationFromGenerated(generatedSource);
const proofMatrix = parseProofMatrixYaml(fs.readFileSync(PROOF_MATRIX_PATH, "utf8"));
const e2eHooksRaw = fs.readFileSync(E2E_HOOKS_PATH, "utf8");

const logicViolations = collectCertificationViolations({
  manifestTiers,
  generatedTiers,
  proofMatrix,
  e2eHooksRaw,
  repoRoot: REPO_ROOT,
});

if (logicViolations.length === 0) {
  pass("tier_manifest_generated_sync");
  pass("proof_matrix_complete");
} else {
  for (const violation of logicViolations) {
    fail(violation);
  }
}

const denaliCertified = generatedTiers.denali === "certified";
if (denaliCertified) {
  const cert01 = spawnSync("node", ["scripts/generate-workspace-registry.mjs", "--check"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (cert01.status === 0) {
    pass("cert01_registry_fresh");
  } else {
    fail("CERT-01: registry --check failed");
    const output = `${cert01.stdout ?? ""}${cert01.stderr ?? ""}`.trim();
    if (output) console.error(output);
  }
}

if (violations.length > 0) {
  console.error(`guard-workspace-certification: FAIL (${violations.length})`);
  process.exit(1);
}

console.log("guard-workspace-certification: PASS");
