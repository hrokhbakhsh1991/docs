/**
 * P8 — Intake UI moved to workspace plugins; schema renderer lives in catalog-intake-ui.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const rendererPath = join(repoRoot, "packages/catalog-intake-ui/src/render-intake-form.tsx");
const denaliIntakePath = join(
  repoRoot,
  "packages/workspaces/denali/src/catalog/registration-flow/denali-registration-flow.steps.tsx"
);

describe("catalog-intake renderer contract", () => {
  it("P8-INT-01 schema renderer is plugin-consumed, not portal-owned", () => {
    const renderer = readFileSync(rendererPath, "utf8");
    const denaliIntake = readFileSync(denaliIntakePath, "utf8");
    assert.match(renderer, /schema\.fields\.map/);
    assert.match(renderer, /idPrefix/);
    assert.match(renderer, /invalidFieldId/);
    assert.doesNotMatch(renderer, /hasError/);
    assert.match(denaliIntake, /RenderIntakeForm/);
    assert.doesNotMatch(renderer, /denali|urban/);
  });
});
