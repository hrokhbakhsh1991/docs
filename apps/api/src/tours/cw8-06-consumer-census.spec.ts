/**
 * CW8-06 — consumer census assertions: legacy flat persist path retired.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const TOURS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TOURS_DIR, "../../../..");

describe("cw8-06-consumer-census", () => {
  it("census doc exists", () => {
    const censusPath = join(REPO_ROOT, "docs/dev/cw8-06-legacy-validation-census.md");
    const text = readFileSync(censusPath, "utf8");
    assert.match(text, /CW8-06/);
    assert.match(text, /runWorkspaceValidationHooks/);
  });

  it("canonical-validation-sync has no legacy flat-hook persist branch", () => {
    const source = readFileSync(join(TOURS_DIR, "canonical-validation-sync.ts"), "utf8");
    assert.doesNotMatch(source, /runWorkspaceValidationHooks/);
    assert.doesNotMatch(source, /runValidationModePublishGate/);
    assert.doesNotMatch(source, /isWorkspaceValidationPipelineEnabled/);
    assert.match(source, /runWorkspaceValidationPipeline/);
  });

  it("policy supersede env gates removed from pipeline runner", () => {
    const source = readFileSync(join(TOURS_DIR, "run-workspace-validation-pipeline.ts"), "utf8");
    assert.doesNotMatch(source, /isWorkspaceValidationPipelinePolicySupersedeEnabled/);
    assert.doesNotMatch(source, /WORKSPACE_VALIDATION_PIPELINE_DENALI_POLICY/);
    assert.doesNotMatch(source, /WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY/);
    assert.match(source, /supersedesFlatHooks/);
  });

  it("retained flat-hook helper still wired for non-superseding workspaces", () => {
    const source = readFileSync(join(TOURS_DIR, "run-workspace-validation-pipeline.ts"), "utf8");
    assert.match(source, /runWorkspaceValidationHooks/);
    assert.match(source, /runValidationModePublishGate/);
  });
});
