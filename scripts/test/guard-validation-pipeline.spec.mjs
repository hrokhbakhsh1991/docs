/**
 * CW8-07 — negative fixtures for guard-validation-pipeline matchers.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "../..");
const TOURS_DIR = join(REPO_ROOT, "apps/api/src/tours");

function readPipelineStagesBlock() {
  const source = readFileSync(join(TOURS_DIR, "run-workspace-validation-pipeline.ts"), "utf8");
  const stagesIndex = source.indexOf("const PIPELINE_STAGES");
  assert.ok(stagesIndex >= 0);
  return source.slice(stagesIndex, stagesIndex + 500);
}

describe("guard-validation-pipeline fixtures", () => {
  it("production pipeline stage order is shared → capability → policy", () => {
    const block = readPipelineStagesBlock();
    const sharedIndex = block.indexOf("runSharedValidationStage");
    const capabilityIndex = block.indexOf("runCapabilityValidationStage");
    const policyIndex = block.indexOf("runWorkspacePolicyValidationStage");
    assert.ok(sharedIndex >= 0 && capabilityIndex > sharedIndex && policyIndex > capabilityIndex);
  });

  it("canonical-validation-sync does not reference legacy flat-hook persist path", () => {
    const source = readFileSync(join(TOURS_DIR, "canonical-validation-sync.ts"), "utf8");
    assert.equal(source.includes("runWorkspaceValidationHooks"), false);
    assert.match(source, /runWorkspaceValidationPipeline/);
  });

  it("invalid stage order fixture would fail certification ordering", () => {
    const invalidBlock =
      "const PIPELINE_STAGES = [runWorkspacePolicyValidationStage, runSharedValidationStage]";
    const sharedIndex = invalidBlock.indexOf("runSharedValidationStage");
    const policyIndex = invalidBlock.indexOf("runWorkspacePolicyValidationStage");
    assert.ok(policyIndex < sharedIndex);
  });
});
