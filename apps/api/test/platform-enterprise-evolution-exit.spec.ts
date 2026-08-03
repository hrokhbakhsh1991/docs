/**
 * P5 — enterprise evolution phase exit contract (agent pack verification)
 * @see docs/phase-18/agent-pack/p5-a-cutover-pilot.md P5-A-N-013
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const gateScriptPath = join(repoRoot, "scripts/p5-enterprise-evolution-gate.sh");
const packageJsonPath = join(repoRoot, "package.json");
const manifestPath = join(repoRoot, "docs/phase-18/agent-pack/AGENT-MANIFEST.yaml");
const preservationPath = join(repoRoot, "docs/phase-18/agent-pack/PRESERVATION-CHECKLIST.md");
const exitChecklistPath = join(repoRoot, "docs/phase-18/agent-pack/p5-exit-checklist.md");

describe("platform-enterprise-evolution-exit (P5 agent pack)", () => {
  it("EX-P5-01 p5:gate script and package.json wiring", () => {
    const gate = readFileSync(gateScriptPath, "utf8");
    assert.match(gate, /guard:import-boundary/);
    assert.match(gate, /platform-tenant-workspace-definition-audit\.spec\.ts/);
    assert.match(gate, /workspace-metadata-cutover-metrics\.spec\.ts/);
    assert.match(gate, /platform-club-workspace-cutover-tab\.spec\.ts/);
    assert.match(gate, /workspace-metadata-denali-parity-publish\.spec\.ts/);
    assert.match(gate, /form-profile-strip\.spec\.ts/);
    assert.match(gate, /catalog-ref-integrity\.spec\.ts/);
    assert.match(gate, /operator-metadata-plugin-resolve\.spec\.ts/);
    assert.match(gate, /denali-metadata-path-publish-integration\.spec\.ts/);
    assert.match(gate, /tour-patch-audit\.spec\.ts/);
    assert.match(gate, /tour-publish-audit\.spec\.ts/);
    assert.match(gate, /client-server-rules-parity\.spec\.ts/);
    assert.match(gate, /platform-workspace-definition-publish\.spec\.ts/);
    assert.match(gate, /workspace-metadata-commerce-inherit\.spec\.ts/);
    assert.match(gate, /tour-create-payment-mode-default\.spec\.ts/);
    assert.match(gate, /platform-club-commerce-badge\.spec\.ts/);
    assert.match(gate, /P5_ENTERPRISE_EVOLUTION_GATE_OK/);

    const pkg = readFileSync(packageJsonPath, "utf8");
    assert.match(pkg, /"p5:gate":\s*"bash scripts\/p5-enterprise-evolution-gate\.sh"/);
  });

  it("EX-P5-02 agent manifest and preservation checklist exist", () => {
    const manifest = readFileSync(manifestPath, "utf8");
    assert.match(manifest, /nano_total: 56/);
    assert.match(manifest, /current_task: null/);
    assert.match(manifest, /nano_done: 56/);
    assert.match(manifest, /exit_core: P5-B-N-016/);
    assert.match(manifest, /epic_optional:\n- P5-C\n- P5-D\n- P5-E/);

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
    assert.match(cutover, /execution_spec: docs\/phase-18\/agent-pack\/p5-a-cutover-pilot.md/);
    assert.match(parity, /execution_spec: docs\/phase-18\/agent-pack\/p5-b-denali-operator-parity.md/);
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
    const index = readFileSync(join(repoRoot, "docs/phase-18/agent-pack/DOC-SYNC-INDEX.md"), "utf8");
    assert.match(index, /doc_integrity_score: 9\.9\/10/);
    assert.match(index, /current_task: null/);
    assert.match(index, /nano_done: 56/);
  });

  it("EX-A-01 P5-A exit checklist lists EPIC-A deliverables", () => {
    const checklist = readFileSync(exitChecklistPath, "utf8");
    assert.match(checklist, /P5-A complete \(N-014\)/);
    assert.match(checklist, /metadataCutoverStage/);
    assert.match(checklist, /Allowlist expand runbook DOC-03 \(N-010\)/);
    assert.match(checklist, /p5:gate flesh \+ web UI specs GATE-04\.\.05 \(N-013\)/);
  });

  it("EX-A-02 enterprise assessment documents staging pilot (P5-A)", () => {
    const assessment = readFileSync(
      join(repoRoot, "docs/phase-18/agent-pack/wizard-denali-enterprise-assessment.md"),
      "utf8"
    );
    assert.match(assessment, /Stage 2 Pilot.*✅/);
    assert.match(assessment, /platform-metadata-cutover-pilot/);
    assert.match(assessment, /metadataCutoverStage/);
  });

  it("EX-P5-09 enterprise assessment documents P5-full exit ≥9.5", () => {
    const assessment = readFileSync(
      join(repoRoot, "docs/phase-18/agent-pack/wizard-denali-enterprise-assessment.md"),
      "utf8"
    );
    assert.match(assessment, /P5-full EPIC exit/);
    assert.match(assessment, /P5-E-N-006/);
    assert.match(assessment, /9\.5\/10/);
    assert.match(assessment, /offline_receipt/);
  });
});
