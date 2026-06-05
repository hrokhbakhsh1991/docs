#!/usr/bin/env node
/**
 * Phase 7 — documentation execution-system hardening (target >= 96).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateAntiHollowPhase7 } from "./anti-hollow-phase7.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const PHASE7 = path.join(REPO_ROOT, "docs/phase-7");

function readUtf8(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

function subphaseFile(id) {
  const glob = fs.readdirSync(path.join(PHASE7, "subphases"));
  return glob.find((f) => f.startsWith(`${id}-`) && !f.endsWith(".skeleton.md"));
}

export function evaluatePhase7DocHardening() {
  const failures = [];
  const hints = [];

  const requiredPaths = [
    "docs/phase-7/appendices/BOOT-MANIFEST.yaml",
    "docs/phase-7/appendices/IMPLEMENTATION-DECISIONS.md",
    "docs/phase-7/appendices/IMPLEMENTATION-MAP.md",
    "docs/phase-7/appendices/industry-alignment-2026.md",
    "docs/phase-7/appendices/env-runtime-matrix.md",
    "docs/phase-7/appendices/phase-6-bridge.md",
    "docs/phase-7/appendices/URBAN-MINIMAL-SCOPE.md",
    "docs/phase-7/appendices/TENANT-ROUTER-SPEC.md",
    "docs/phase-7/appendices/OBSERVABILITY-RUNBOOK.md",
    "docs/phase-7/appendices/LEGACY-URBAN-REFERENCE.md",
    "docs/phase-7/appendices/anti-hollow-contract.md",
    "docs/phase-7/appendices/test-matrix.md",
    "docs/phase-7/appendices/blockers.md",
    "docs/phase-7/appendices/action-registry.md",
    "docs/phase-7/appendices/req-p7-command-atlas.md",
    "docs/phase-7/appendices/verification-commands.md",
    "docs/phase-7/appendices/SMOKE-SCENARIO-MAP.md",
    "docs/phase-7/appendices/ADVERSARIAL-MATRIX.md",
    "docs/phase-7/appendices/FORENSIC-RUBRIC.md",
    "docs/phase-7/appendices/adr-007.md",
    "docs/phase-7/appendices/PRECISION-DOC-INDEX.md",
    "docs/phase-7/appendices/test-inventory.md",
    "docs/phase-7/appendices/cross-cutting-actions.md",
    "docs/phase-7/audits/DOC-EXECUTION-SCORECARD.md",
    "docs/phase-7/audits/verification-matrix.md",
    "docs/phase-7/audits/coverage-matrix.md",
    "docs/phase-7/audits/traceability-map.md",
    "docs/phase-7/audits/CONSISTENCY-REPORT.md",
    "docs/phase-7/audits/SUBPHASE-READY-SPEC.md",
    "docs/phase-7/audits/subphase-enforcement-map.md",
    "docs/phase-7/audits/execution-action-index.md",
    "docs/phase-7/audits/IMPLEMENTATION-TRUTH.md",
    "docs/phase-7/AI-READABILITY-REPORT.md",
    "docs/phase-7/QUALITY-VALIDATION.md",
    "docs/phase-7/phase-7-agent-router.md",
    "docs/phase-7/phase-7-enforcement.md",
    "docs/phase-7/phase-7-state-machine.md",
    "docs/phase-7/phase-7-guards.md",
    "docs/phase-7-platform-dod.md",
    "docs/appendices/PLATFORM-CONTINUITY-0-7.md",
    "docs/research/phase-7-workspace-hardening-research.md",
    "docs/research/phase-7-workspace-hardening-research.ai-exec.md",
    "reports/phase-7-genericity-baseline.yaml",
  ];
  for (const p of requiredPaths) {
    if (!exists(p)) failures.push(`missing ${p}`);
  }

  const router = readUtf8("docs/phase-7/phase-7-agent-router.md");
  if (!/BOOT-MANIFEST\.yaml/.test(router)) failures.push("router must reference BOOT-MANIFEST");
  if (!/sole_execution_entry:\s*true/.test(router)) {
    failures.push("router must declare sole_execution_entry");
  }
  if (!/verification_matrix/.test(router)) failures.push("router must reference verification_matrix");
  if (!/state_machine/.test(router)) failures.push("router must reference state_machine");

  const readme = readUtf8("docs/phase-7/README.md");
  if (!/critical spec quality.*\*\*9[56]\*\*/i.test(readme) && !/critical_spec_quality:\s*96/.test(readme)) {
    failures.push("README must document critical spec quality >= 96");
  }

  const aiRead = readUtf8("docs/phase-7/AI-READABILITY-REPORT.md");
  if (!/doc_execution_system:\s*96/.test(aiRead)) {
    failures.push("AI-READABILITY must show doc_execution_system 96");
  }

  const scorecard = readUtf8("docs/phase-7/audits/DOC-EXECUTION-SCORECARD.md");
  if (!/Doc execution system.*\*\*96\*\*/.test(scorecard)) {
    failures.push("DOC-EXECUTION-SCORECARD must show doc execution 96");
  }
  if (!/Critical spec quality.*\*\*96\*\*/.test(scorecard)) {
    failures.push("DOC-EXECUTION-SCORECARD must show critical spec quality 96");
  }

  const stateMachine = readUtf8("docs/phase-7/phase-7-state-machine.md");
  if (!/TG-P7-005/.test(stateMachine) || !/7\.5 \+ 7\.6/.test(stateMachine)) {
    failures.push("state-machine must require 7.5+7.6 before 7.7 via TG-P7-005");
  }

  const testMatrix = readUtf8("docs/phase-7/appendices/test-matrix.md");
  if (!/TARGET/.test(testMatrix)) failures.push("test-matrix must label TARGET honesty");

  const testInventory = readUtf8("docs/phase-7/appendices/test-inventory.md");
  if (!/urban-workspace-plugin\.spec\.ts/.test(testInventory)) {
    failures.push("test-inventory must name urban-workspace-plugin.spec.ts");
  }

  const decisions = readUtf8("docs/phase-7/appendices/IMPLEMENTATION-DECISIONS.md");
  for (const token of ["DEC-P7-001", "DEC-P7-003", "DEC-P7-005", "DEC-P7-008", "platform-core unchanged"]) {
    if (!decisions.includes(token)) failures.push(`IMPLEMENTATION-DECISIONS missing ${token}`);
  }

  const boot = readUtf8("docs/phase-7/appendices/BOOT-MANIFEST.yaml");
  if (!/detect_current_subphase/.test(boot)) failures.push("BOOT-MANIFEST missing detect_current_subphase");
  if (!/verification-matrix/.test(boot)) failures.push("BOOT-MANIFEST must boot-read verification-matrix");

  const envMatrix = readUtf8("docs/phase-7/appendices/env-runtime-matrix.md");
  if (!/REDIS_URL/.test(envMatrix)) failures.push("env-runtime-matrix must document REDIS_URL");

  const urbanScope = readUtf8("docs/phase-7/appendices/URBAN-MINIMAL-SCOPE.md");
  if (!/tour\.venueName/.test(urbanScope) || !/Forbidden fields/.test(urbanScope)) {
    failures.push("URBAN-MINIMAL-SCOPE must define field table + forbidden fields");
  }

  const routerSpec = readUtf8("docs/phase-7/appendices/TENANT-ROUTER-SPEC.md");
  if (!/databaseUrl/.test(routerSpec) || !/useRls/.test(routerSpec)) {
    failures.push("TENANT-ROUTER-SPEC must align with TenantRoute extension");
  }

  const subphaseIds = ["7.0", "7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9"];
  for (const id of subphaseIds) {
    const file = subphaseFile(id);
    if (!file) {
      failures.push(`missing subphase file for ${id}`);
      continue;
    }
    const body = fs.readFileSync(path.join(PHASE7, "subphases", file), "utf8");
    if (!/repo_status:/.test(body)) failures.push(`${file} missing repo_status`);
    if (!/action_ids:/.test(body)) failures.push(`${file} missing action_ids`);
    if (!/REQ-P7/.test(body)) failures.push(`${file} missing REQ-P7 linkage`);
    if (!/completion_proof:/.test(body)) failures.push(`${file} missing completion_proof`);
    if (!/Primary spec:/.test(body)) failures.push(`${file} missing Primary spec section`);
    if (!/^## Actions/m.test(body)) failures.push(`${file} missing ## Actions section`);
    if (!/P7-\d+-A\d+:/.test(body)) failures.push(`${file} missing expanded action blocks`);
  }

  const vm = readUtf8("docs/phase-7/audits/verification-matrix.md");
  if (!/REQ-P7-035/.test(vm) || !/REQ-P7-001/.test(vm)) {
    failures.push("verification-matrix incomplete REQ-P7 range");
  }
  if (!/urban-workspace-plugin\.spec\.ts/.test(vm)) {
    failures.push("verification-matrix REQ-P7-009 should reference urban-workspace-plugin.spec.ts");
  }

  const enforcement = readUtf8("docs/phase-7/phase-7-enforcement.md");
  if (!/RULE-P7-001:/.test(enforcement) || !/subphase_dod/.test(enforcement)) {
    failures.push("phase-7-enforcement missing RULE-P7 or subphase_dod");
  }
  if (!/TG-P7-005/.test(enforcement)) failures.push("enforcement must reference TG-P7-005");

  const actionReg = readUtf8("docs/phase-7/appendices/action-registry.md");
  if (!/P7-3-A04/.test(actionReg) || !/P7-9-A05/.test(actionReg)) {
    failures.push("action-registry must list per-action rows through P7-9-A05");
  }

  const consistency = readUtf8("docs/phase-7/audits/CONSISTENCY-REPORT.md");
  if (!/Executable checklist/.test(consistency) || !/critical_spec_quality_score:\s*96/.test(consistency)) {
    failures.push("CONSISTENCY-REPORT missing executable checklist or critical score 96");
  }
  if (!/TG-P7-005/.test(consistency)) failures.push("CONSISTENCY-REPORT must check TG-P7-005");

  const entryYaml = readUtf8("reports/phase-7-entry-verified.yaml");
  if (!/phase_6_gate:/.test(entryYaml)) failures.push("phase-7-entry-verified.yaml missing phase_6_gate");
  if (!/critical_spec_quality:\s*96/.test(entryYaml)) {
    failures.push("phase-7-entry-verified.yaml missing critical_spec_quality 96");
  }
  if (!/does not unlock 7\.1/.test(entryYaml)) {
    failures.push("entry yaml must separate doc_pack from phase_6_gate");
  }

  const map = readUtf8("docs/phase-7/appendices/IMPLEMENTATION-MAP.md");
  if (!/hot_paths/.test(map)) failures.push("IMPLEMENTATION-MAP missing hot_paths table");

  const adversarial = readUtf8("docs/phase-7/appendices/ADVERSARIAL-MATRIX.md");
  if (!/ADV-P7-P0-01/.test(adversarial) || !/ADV-P7-P1-01/.test(adversarial)) {
    failures.push("ADVERSARIAL-MATRIX must define P0 and P1 rows");
  }

  const smoke = readUtf8("docs/phase-7/appendices/SMOKE-SCENARIO-MAP.md");
  if (!/SMK-P7-01/.test(smoke) || !/urban-workspace-plugin/.test(smoke)) {
    failures.push("SMOKE-SCENARIO-MAP incomplete");
  }

  const forensic = readUtf8("docs/audits/phase-7-zero-debt-forensic-audit.mdoc");
  if (!/verdict:\s*PENDING/.test(forensic)) {
    failures.push("phase-7 forensic must stay PENDING until closure");
  }

  const research = readUtf8("docs/research/phase-7-workspace-hardening-research.md");
  if (!/non_authoritative_for_execution:\s*true/.test(research)) {
    failures.push("research must declare non_authoritative_for_execution");
  }
  if (!/workspace-wizard\.config\.spec\.ts.*L11/.test(research)) {
    failures.push("research must cite legacy denali rail anti-pattern with line ref");
  }

  const hollow = evaluateAntiHollowPhase7();
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
  const r = evaluatePhase7DocHardening();
  if (!r.ok) {
    console.error(`phase-7-doc-hardening: FAIL — ${r.detail}`);
    process.exit(1);
  }
  console.log(`phase-7-doc-hardening: PASS (${r.score_hints.join(", ")})`);
}
