import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(
  REPO_ROOT,
  "docs/architecture/field-exposure-system.md"
);
const GUARD_SCRIPT = join(
  REPO_ROOT,
  "scripts/guards/field-exposure-phase-1-guard.mjs"
);

const GLOSSARY_TERMS = [
  "ExposureSurface",
  "Audience",
  "ActivationTrigger",
  "FieldExposurePolicy",
  "ExposureProfile",
  "ExposureIntent",
  "ExposureContext",
  "ExposureDecision",
  "ExposureResolver",
];

describe("field exposure phase 1 language contract", () => {
  it("architecture doc marks Phase 1 complete with glossary and ADRs", () => {
    assert.equal(existsSync(EXPOSURE_DOC), true);
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /Phase 1 complete/i);
    assert.match(text, /## Glossary/);
    assert.match(text, /## Architecture Decision Records \(Phase 1\)/);
    assert.match(text, /## Legacy → Exposure Vocabulary Mapping/);
    assert.match(text, /## Forbidden and Transitional Vocabulary/);
    assert.match(text, /guard:field-exposure-phase-1/);
    for (const term of GLOSSARY_TERMS) {
      assert.match(text, new RegExp(`\\| \`${term}\` \\|`));
    }
    assert.match(text, /ADR-FE-001/);
    assert.match(text, /ADR-FE-005/);
  });

  it("phase 1 guard passes on repository closure state", () => {
    assert.equal(existsSync(GUARD_SCRIPT), true);
    const result = spawnSync("node", [GUARD_SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || "guard failed"
    );
  });
});
