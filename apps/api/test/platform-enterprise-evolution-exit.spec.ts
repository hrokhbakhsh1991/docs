/**
 * P5 — enterprise evolution phase exit contract (agent pack verification)
 * @see TEMP/p5/p5-a-cutover-pilot.md P5-A-N-013
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const gateScriptPath = join(repoRoot, "scripts/p5-enterprise-evolution-gate.sh");
const packageJsonPath = join(repoRoot, "package.json");
const manifestPath = join(repoRoot, "TEMP/p5/AGENT-MANIFEST.yaml");
const preservationPath = join(repoRoot, "TEMP/p5/PRESERVATION-CHECKLIST.md");
const exitChecklistPath = join(repoRoot, "TEMP/p5-exit-checklist.md");

describe("platform-enterprise-evolution-exit (P5 agent pack)", () => {
  it("EX-P5-01 p5:gate script and package.json wiring", () => {
    const gate = readFileSync(gateScriptPath, "utf8");
    assert.match(gate, /guard:import-boundary/);
    assert.match(gate, /guard:p3-denali-covenant/);
    assert.match(gate, /P5_ENTERPRISE_EVOLUTION_GATE_OK/);

    const pkg = readFileSync(packageJsonPath, "utf8");
    assert.match(pkg, /"p5:gate":\s*"bash scripts\/p5-enterprise-evolution-gate\.sh"/);
  });

  it("EX-P5-02 agent manifest and preservation checklist exist", () => {
    const manifest = readFileSync(manifestPath, "utf8");
    assert.match(manifest, /nano_total: 56/);
    assert.match(manifest, /current_task: P5-A-N-004/);
    assert.match(manifest, /exit_core: P5-B-N-016/);
    assert.match(manifest, /epic_optional: \[P5-C, P5-D, P5-E\]/);

    const preservation = readFileSync(preservationPath, "utf8");
    assert.match(preservation, /PC-01/);
    assert.match(preservation, /PC-10/);
    assert.match(preservation, /offline_receipt/);
  });

  it("EX-P5-03 exit checklist defines path A core vs path B full", () => {
    const checklist = readFileSync(exitChecklistPath, "utf8");
    assert.match(checklist, /Path A — P5-core/);
    assert.match(checklist, /Path B — P5-full/);
    assert.match(checklist, /P5-B-N-016/);
    assert.match(checklist, /P5-E-N-006/);
  });

  it("EX-P5-04 phase-18 doc pack scaffold complete for core path", () => {
    const cutover = readFileSync(
      join(repoRoot, "docs/phase-18/platform-metadata-cutover-pilot.mdoc"),
      "utf8"
    );
    const parity = readFileSync(
      join(repoRoot, "docs/phase-18/platform-denali-operator-parity.mdoc"),
      "utf8"
    );
    const readme = readFileSync(join(repoRoot, "docs/phase-18/README.md"), "utf8");
    assert.match(cutover, /execution_spec: TEMP\/p5\/p5-a-cutover-pilot.md/);
    assert.match(parity, /execution_spec: TEMP\/p5\/p5-b-denali-operator-parity.md/);
    assert.match(readme, /platform-metadata-cutover-pilot/);
    assert.match(readme, /platform-denali-operator-parity/);
  });

  it("EX-P5-06 cutover derivation landed per phase-18 status", () => {
    const mdoc = readFileSync(
      join(repoRoot, "docs/phase-18/platform-metadata-cutover-pilot.mdoc"),
      "utf8"
    );
    assert.match(mdoc, /deriveMetadataCutoverStage/);
    assert.match(mdoc, /Implementation status/);
    assert.match(mdoc, /CO-01\.\.05/);

    const derive = readFileSync(
      join(repoRoot, "apps/api/src/workspace-metadata/derive-metadata-cutover-stage.ts"),
      "utf8"
    );
    assert.match(derive, /MetadataCutoverStage/);
  });

  it("EX-P5-08 DOC-SYNC index is canonical cross-file SoT", () => {
    const index = readFileSync(join(repoRoot, "TEMP/p5/DOC-SYNC-INDEX.md"), "utf8");
    assert.match(index, /doc_integrity_score: 9\.9\/10/);
    assert.match(index, /current_task: P5-A-N-004/);
    assert.match(index, /nano_done: 3/);
  });
});
