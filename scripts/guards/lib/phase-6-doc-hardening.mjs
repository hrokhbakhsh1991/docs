#!/usr/bin/env node
/**
 * Phase 6 — documentation execution-system hardening (target >= 96).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateAntiHollowPhase6 } from "./anti-hollow-phase6.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const PHASE6 = path.join(REPO_ROOT, "docs/phase-6");

function readUtf8(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

function subphaseFile(id) {
  const glob = fs.readdirSync(path.join(PHASE6, "subphases"));
  return glob.find((f) => f.startsWith(`${id}-`) && !f.endsWith(".skeleton.md"));
}

export function evaluatePhase6DocHardening() {
  const failures = [];
  const hints = [];

  const requiredPaths = [
    "docs/phase-6/appendices/BOOT-MANIFEST.yaml",
    "docs/phase-6/appendices/DEPRECATED-ENTRYPOINTS.md",
    "docs/phase-6/appendices/FORENSIC-RUBRIC.md",
    "docs/phase-6/appendices/IMPLEMENTATION-DECISIONS.md",
    "docs/phase-6/appendices/industry-alignment-2026.md",
    "docs/phase-6/appendices/env-runtime-matrix.md",
    "docs/phase-6/appendices/adr-006.md",
    "docs/phase-6/appendices/req-p6-command-atlas.md",
    "docs/phase-6/appendices/anti-hollow-contract.md",
    "docs/phase-6/appendices/verification-commands.md",
    "docs/phase-6/appendices/LEGACY-PORT-CHECKLIST.md",
    "docs/phase-6/appendices/SMOKE-SCENARIO-MAP.md",
    "docs/phase-6/audits/DOC-EXECUTION-SCORECARD.md",
    "docs/phase-6/audits/verification-matrix.md",
    "docs/phase-6/audits/coverage-matrix.md",
    "docs/phase-6/audits/traceability-map.md",
    "docs/phase-6/audits/CONSISTENCY-REPORT.md",
    "docs/phase-6/audits/SUBPHASE-READY-SPEC.md",
    "docs/phase-6/audits/subphase-enforcement-map.md",
    "docs/phase-6/audits/execution-action-index.md",
    "docs/phase-6/AI-READABILITY-REPORT.md",
    "docs/phase-6/QUALITY-VALIDATION.md",
    "docs/phase-6/phase-6-agent-router.md",
    "docs/phase-6-denali-workspace.md",
    "docs/appendices/PLATFORM-CONTINUITY-0-6.md",
    "docs/research/phase-6-denali-workspace-research.md",
  ];
  for (const p of requiredPaths) {
    if (!exists(p)) failures.push(`missing ${p}`);
  }

  const contract = readUtf8("docs/phase-6/appendices/agent-contract.md");
  if (!/DEPRECATED/i.test(contract)) {
    failures.push("agent-contract.md must declare DEPRECATED");
  }

  const router = readUtf8("docs/phase-6/phase-6-agent-router.md");
  if (!/BOOT-MANIFEST\.yaml/.test(router)) failures.push("router must reference BOOT-MANIFEST");
  if (!/sole_execution_entry:\s*true/.test(router)) {
    failures.push("router must declare sole_execution_entry");
  }
  if (!/verification_matrix/.test(router)) failures.push("router must reference verification_matrix");

  const readme = readUtf8("docs/phase-6/README.md");
  if (!/critical spec quality.*\*\*9[56]\*\*/i.test(readme) && !/critical_spec_quality:\s*96/.test(readme)) {
    failures.push("README must document critical spec quality >= 96");
  }

  const aiRead = readUtf8("docs/phase-6/AI-READABILITY-REPORT.md");
  if (!/doc_execution_system:\s*96/.test(aiRead)) {
    failures.push("AI-READABILITY must show doc_execution_system 96");
  }

  const scorecard = readUtf8("docs/phase-6/audits/DOC-EXECUTION-SCORECARD.md");
  if (!/Doc execution system.*\*\*96\*\*/.test(scorecard)) {
    failures.push("DOC-EXECUTION-SCORECARD must show doc execution 96");
  }
  if (!/Critical spec quality.*\*\*96\*\*/.test(scorecard)) {
    failures.push("DOC-EXECUTION-SCORECARD must show critical spec quality 96");
  }

  const stateMachine = readUtf8("docs/phase-6/phase-6-state-machine.md");
  if (!/TG-P6-005/.test(stateMachine) || !/6\.2 \+ 6\.3 \+ 6\.4/.test(stateMachine)) {
    failures.push("state-machine must require 6.2+6.3+6.4 before 6.5 via TG-P6-005");
  }
  if (/6\.5 blocked until 6\.2 VERIFIED_BEHAVIORAL\s*\|/.test(stateMachine)) {
    failures.push("state-machine must not say 6.5 only after 6.2 without 6.3+6.4");
  }

  const testMatrix = readUtf8("docs/phase-6/appendices/test-matrix.md");
  if (!/TARGET/.test(testMatrix)) failures.push("test-matrix must label TARGET honesty");

  const decisions = readUtf8("docs/phase-6/appendices/IMPLEMENTATION-DECISIONS.md");
  for (const token of ["DEC-P6-001", "DEC-P6-003", "DEC-P6-005", "DEC-P6-008", "platform-core unchanged"]) {
    if (!decisions.includes(token)) failures.push(`IMPLEMENTATION-DECISIONS missing ${token}`);
  }

  const boot = readUtf8("docs/phase-6/appendices/BOOT-MANIFEST.yaml");
  if (!/detect_current_subphase/.test(boot)) failures.push("BOOT-MANIFEST missing detect_current_subphase");
  if (!/verification-matrix/.test(boot)) failures.push("BOOT-MANIFEST must boot-read verification-matrix");

  const envMatrix = readUtf8("docs/phase-6/appendices/env-runtime-matrix.md");
  if (!/MINIO_ENDPOINT/.test(envMatrix)) failures.push("env-runtime-matrix must document MINIO_ENDPOINT");

  const subphaseIds = ["6.0", "6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9"];
  for (const id of subphaseIds) {
    const file = subphaseFile(id);
    if (!file) {
      failures.push(`missing subphase file for ${id}`);
      continue;
    }
    const body = fs.readFileSync(path.join(PHASE6, "subphases", file), "utf8");
    if (!/repo_status:/.test(body)) failures.push(`${file} missing repo_status`);
    if (!/action_ids:/.test(body)) failures.push(`${file} missing action_ids`);
    if (!/REQ-P6/.test(body)) failures.push(`${file} missing REQ-P6 linkage`);
    if (!/completion_proof:/.test(body)) failures.push(`${file} missing completion_proof`);
    if (!/Primary spec:/.test(body)) failures.push(`${file} missing Primary spec section`);
  }

  const vm = readUtf8("docs/phase-6/audits/verification-matrix.md");
  if (!/REQ-P6-030/.test(vm) || !/REQ-P6-001/.test(vm)) {
    failures.push("verification-matrix incomplete REQ-P6 range");
  }
  if (!/apps\/web\/build/.test(vm) && !/denali-workspace-plugin/.test(vm)) {
    failures.push("verification-matrix REQ-P6-014 should reference concrete verify path");
  }

  const enforcement = readUtf8("docs/phase-6/phase-6-enforcement.md");
  if (!/RULE-P6-001:/.test(enforcement) || !/subphase_dod/.test(enforcement)) {
    failures.push("phase-6-enforcement missing RULE-P6 or subphase_dod");
  }

  const actionReg = readUtf8("docs/phase-6/appendices/action-registry.md");
  if (!/P6-2-A06/.test(actionReg) || !/P6-9-A05/.test(actionReg)) {
    failures.push("action-registry must list per-action rows through P6-9-A05");
  }

  const consistency = readUtf8("docs/phase-6/audits/CONSISTENCY-REPORT.md");
  if (!/Executable checklist/.test(consistency) || !/critical_spec_quality_score:\s*96/.test(consistency)) {
    failures.push("CONSISTENCY-REPORT missing executable checklist or critical score 96");
  }

  const entryYaml = readUtf8("reports/phase-6-entry-verified.yaml");
  if (!/phase_5_gate:/.test(entryYaml)) failures.push("phase-6-entry-verified.yaml missing phase_5_gate");
  if (!/critical_spec_quality:\s*96/.test(entryYaml)) {
    failures.push("phase-6-entry-verified.yaml missing critical_spec_quality 96");
  }
  if (!/does not unlock 6\.1/.test(entryYaml)) {
    failures.push("entry yaml must separate doc_pack from phase_5_gate");
  }

  const map = readUtf8("docs/phase-6/appendices/IMPLEMENTATION-MAP.md");
  if (!/hot_paths/.test(map)) failures.push("IMPLEMENTATION-MAP missing hot_paths table (REQ-P6-029)");

  const forensic = readUtf8("docs/audits/phase-6-zero-debt-forensic-audit.mdoc");
  if (!/verdict:\s*PENDING/.test(forensic)) {
    failures.push("phase-6 forensic must stay PENDING until closure");
  }

  const research = readUtf8("docs/research/phase-6-denali-workspace-research.md");
  if (!/non_authoritative_for_execution:\s*true/.test(research)) {
    failures.push("research must declare non_authoritative_for_execution");
  }

  const hollow = evaluateAntiHollowPhase6();
  if (!hollow.ok) failures.push(`anti-hollow: ${hollow.detail}`);

  if (failures.length === 0) {
    hints.push("doc_execution_system_target: 96");
    hints.push("critical_spec_quality_target: 96");
  }

  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join("; ") : null,
    score_hints: hints,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = evaluatePhase6DocHardening();
  if (!r.ok) {
    console.error(`phase-6-doc-hardening: FAIL — ${r.detail}`);
    process.exit(1);
  }
  console.log(`phase-6-doc-hardening: PASS (${r.score_hints.join(", ")})`);
}
