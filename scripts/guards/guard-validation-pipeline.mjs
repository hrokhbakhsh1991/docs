#!/usr/bin/env node
/**
 * CW8-07 — validation pipeline guardrails (legacy path retirement + stage order).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const TOURS_DIR = join(REPO_ROOT, "apps/api/src/tours");

/** @type {string[]} */
const violations = [];

const canonicalSync = readFileSync(join(TOURS_DIR, "canonical-validation-sync.ts"), "utf8");
if (canonicalSync.includes("runWorkspaceValidationHooks")) {
  violations.push(
    "canonical-validation-sync.ts: legacy flat-hook persist path reintroduced (runWorkspaceValidationHooks)"
  );
}
if (canonicalSync.includes("isWorkspaceValidationPipelineEnabled")) {
  violations.push(
    "canonical-validation-sync.ts: pipeline flag gate reintroduced — pipeline must be sole persist path"
  );
}
if (!canonicalSync.includes("runWorkspaceValidationPipeline")) {
  violations.push("canonical-validation-sync.ts: missing runWorkspaceValidationPipeline call");
}

const pipelineSource = readFileSync(join(TOURS_DIR, "run-workspace-validation-pipeline.ts"), "utf8");
const stagesIndex = pipelineSource.indexOf("const PIPELINE_STAGES");
if (stagesIndex < 0) {
  violations.push("run-workspace-validation-pipeline.ts: missing PIPELINE_STAGES");
} else {
  const stagesBlock = pipelineSource.slice(stagesIndex, stagesIndex + 500);
  const sharedIndex = stagesBlock.indexOf("runSharedValidationStage");
  const capabilityIndex = stagesBlock.indexOf("runCapabilityValidationStage");
  const policyIndex = stagesBlock.indexOf("runWorkspacePolicyValidationStage");
  if (sharedIndex < 0 || capabilityIndex <= sharedIndex || policyIndex <= capabilityIndex) {
    violations.push(
      "run-workspace-validation-pipeline.ts: PIPELINE_STAGES order must be shared → capability → policy"
    );
  }
}

if (pipelineSource.includes("isWorkspaceValidationPipelinePolicySupersedeEnabled")) {
  violations.push(
    "run-workspace-validation-pipeline.ts: per-workspace policy supersede env gate reintroduced"
  );
}

if (violations.length > 0) {
  console.error("guard-validation-pipeline: FAIL");
  for (const line of violations) {
    console.error(`  ${line}`);
  }
  process.exit(1);
}

console.log("guard-validation-pipeline: PASS");
