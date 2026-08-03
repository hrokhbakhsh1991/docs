/**
 * P5-B-N-016 — Denali operator parity phase exit (P5-core path A)
 * @see docs/phase-18/agent-pack/p5-b-denali-operator-parity.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const exitChecklistPath = join(repoRoot, "docs/phase-18/agent-pack/p5-exit-checklist.md");
const epicSpecPath = join(repoRoot, "docs/phase-18/agent-pack/p5-b-denali-operator-parity.md");
const cutoverMdocPath = join(repoRoot, "docs/phase-18/platform-metadata-cutover-pilot.mdoc");
const parityMdocPath = join(repoRoot, "docs/phase-18/platform-denali-operator-parity.mdoc");

describe("platform-denali-operator-parity-exit (P5-core)", () => {
  it("EX-B-01 epic spec declares exit_core and doc SoT", () => {
    const spec = readFileSync(epicSpecPath, "utf8");
    assert.match(spec, /exit_core: true/);
    assert.match(spec, /platform-denali-operator-parity\.mdoc/);
    assert.match(spec, /P5-B-N-016/);
  });

  it("EX-B-02 phase-18 core mdoc pack exists with verify blocks", () => {
    const cutover = readFileSync(cutoverMdocPath, "utf8");
    assert.match(cutover, /metadataCutoverStage/);
    assert.match(cutover, /## Verify/);
    assert.match(cutover, /guard:p3-denali-covenant/);

    const parity = readFileSync(parityMdocPath, "utf8");
    assert.match(parity, /PC-01/);
    assert.match(parity, /## Verify/);
    assert.match(parity, /p5-preservation-gate/);
  });

  it("EX-B-03 exit checklist path A references P5-B-N-016", () => {
    const checklist = readFileSync(exitChecklistPath, "utf8");
    assert.match(checklist, /Path A — P5-core/);
    assert.match(checklist, /P5-B-N-016/);
    assert.match(checklist, /Preservation gate PC-01/);
  });
});
