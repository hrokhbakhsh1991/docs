#!/usr/bin/env node
/**
 * Phase 5 — documentation execution-system hardening checks (target score >= 95).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const PHASE5 = path.join(REPO_ROOT, "docs/phase-5");

/**
 * @param {string} rel
 * @returns {string}
 */
function readUtf8(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

/**
 * @param {string} rel
 * @returns {boolean}
 */
function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

/**
 * @returns {{ ok: boolean, detail: string | null, score_hints: string[] }}
 */
export function evaluatePhase5DocHardening() {
  const failures = [];
  const hints = [];

  const requiredPaths = [
    "docs/phase-5/appendices/BOOT-MANIFEST.yaml",
    "docs/phase-5/appendices/DEPRECATED-ENTRYPOINTS.md",
    "docs/phase-5/appendices/FORENSIC-RUBRIC.md",
    "docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md",
    "docs/phase-5/audits/DOC-EXECUTION-SCORECARD.md",
    "docs/phase-5/phase-5-agent-router.md",
  ];
  for (const p of requiredPaths) {
    if (!exists(p)) failures.push(`missing ${p}`);
  }

  const contract = readUtf8("docs/phase-5/appendices/agent-contract.md");
  if (!/DEPRECATED/i.test(contract)) {
    failures.push("agent-contract.md must declare DEPRECATED");
  }

  const layer4 = readUtf8("docs/phase-5/phase-5-ai-exec.layer4.md");
  if (/Canonical consolidated spec/i.test(layer4)) {
    failures.push("layer4 must not claim Canonical consolidated spec");
  }
  if (!/ARCHIVE/i.test(layer4)) {
    failures.push("layer4 must declare ARCHIVE status");
  }
  if (layer4.split("\n").length > 200) {
    failures.push(
      `layer4 exceeds 200 lines (${layer4.split("\n").length}) — use router/subphases T2 index`,
    );
  }

  const router = readUtf8("docs/phase-5/phase-5-agent-router.md");
  if (!/BOOT-MANIFEST\.yaml/.test(router)) {
    failures.push("router must reference BOOT-MANIFEST.yaml");
  }
  if (!/pick_rule:\s*min_numeric_id_among_eligible/.test(router)) {
    failures.push("router missing deterministic pick_rule");
  }

  const readme = readUtf8("docs/phase-5/README.md");
  if (!/doc_execution_system.*9[56]/.test(readme.replace(/\s/g, ""))) {
    if (!/Doc execution system.*\*\*9[56]/.test(readme)) {
      failures.push("README must document doc execution system score >= 96");
    }
  }

  const aiRead = readUtf8("docs/phase-5/AI-READABILITY-REPORT.md");
  if (!/Doc execution system.*\*\*9[56]/.test(aiRead)) {
    failures.push("AI-READABILITY must show doc execution system >= 96");
  }

  const stateMachine = readUtf8("docs/phase-5/phase-5-state-machine.md");
  if (!/TG-P5-005/.test(stateMachine)) {
    failures.push("state-machine missing TG-P5-005 (5.4 requires 5.2)");
  }

  const coverage = readUtf8("docs/phase-5/audits/coverage-matrix.md");
  if (/5\.5.*023,036/.test(coverage)) {
    failures.push("coverage-matrix 5.5 must not list REQ-036 (Kafka)");
  }

  const testMatrix = readUtf8("docs/phase-5/appendices/test-matrix.md");
  if (!/SCAFFOLD/.test(testMatrix) || !/apps\/api\/test\/phase-5\.contract/.test(testMatrix)) {
    failures.push("test-matrix must label contract SCAFFOLD at apps/api path");
  }

  const map = readUtf8("docs/MIGRATION-MAP.md");
  if (!/test-inventory/.test(map) || !/SCAFFOLD/.test(map)) {
    failures.push("MIGRATION-MAP Phase 5 must reference scaffold contract honesty");
  }

  const index = readUtf8("docs/phase-5/phase-5.ai-exec.index.md");
  if (!/BOOT-MANIFEST/.test(index)) {
    failures.push("phase-5.ai-exec.index must reference BOOT-MANIFEST");
  }

  const subphases = ["5.0", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6"];
  for (const id of subphases) {
    const glob = fs.readdirSync(path.join(PHASE5, "subphases"));
    const file = glob.find((f) => f.startsWith(`${id}-`) && !f.endsWith(".skeleton.md"));
    if (!file) {
      failures.push(`missing subphase file for ${id}`);
      continue;
    }
    const body = fs.readFileSync(path.join(PHASE5, "subphases", file), "utf8");
    if (!/repo_status:/.test(body)) {
      failures.push(`${file} missing repo_status in completion_proof yaml`);
    }
  }

  const truth = readUtf8("docs/phase-5/audits/IMPLEMENTATION-TRUTH.md");
  if (!/VERIFIED_SCAFFOLD|VERIFIED_BEHAVIORAL/.test(truth)) {
    failures.push("IMPLEMENTATION-TRUTH must use status enums");
  }

  const forbiddenBootPhrases = [
    { file: "docs/phase-5/appendices/agent-contract.md", phrase: "required_read_first:" },
  ];
  for (const { file, phrase } of forbiddenBootPhrases) {
    if (exists(file) && readUtf8(file).includes(phrase) && !/DEPRECATED/.test(readUtf8(file))) {
      failures.push(`${file} still contains stale ${phrase}`);
    }
  }

  const initiator = readUtf8("docs/phase-5/phase-5-ai-exec.md");
  if (/Use layer4|PROCEED to layer4/i.test(initiator)) {
    failures.push("phase-5-ai-exec.md must not direct agents to layer4 execution");
  }
  if (!/phase-5-agent-router/.test(initiator)) {
    failures.push("phase-5-ai-exec.md must reference phase-5-agent-router");
  }

  const structure = readUtf8("docs/phase-5/STRUCTURE-REPORT.md");
  if (/Execute:\s*`?phase-5-ai-exec\.layer4/i.test(structure)) {
    failures.push("STRUCTURE-REPORT must not Execute: phase-5-ai-exec.layer4");
  }
  if (!/phase-5-agent-router/.test(structure)) {
    failures.push("STRUCTURE-REPORT must list phase-5-agent-router as SOLE execution");
  }

  const overview = readUtf8("docs/phase-5/phase-5-overview.md");
  if (!/Out of scope|out_of_scope/i.test(overview) || !/Denali|Phase 6/i.test(overview)) {
    failures.push("phase-5-overview must document Phase 6–7 out-of-scope");
  }

  const boundaries = readUtf8("docs/phase-5/appendices/phase-boundaries.md");
  if (!/FORBIDDEN-00[89]/.test(boundaries)) {
    failures.push("phase-boundaries must list enforcement IDs");
  }

  const skeletonDir = path.join(PHASE5, "subphases");
  for (const name of fs.readdirSync(skeletonDir)) {
    if (!name.endsWith(".skeleton.md")) continue;
    const head = fs
      .readFileSync(path.join(skeletonDir, name), "utf8")
      .split("\n")
      .slice(0, 5)
      .join("\n");
    if (!/DEPRECATED|FORBIDDEN/i.test(head)) {
      failures.push(`${name} must declare DEPRECATED or FORBIDDEN in first 5 lines`);
    }
  }

  const entryYaml = readUtf8("reports/phase-5-entry-verified.yaml");
  if (!/phase_4_gate:\s*\n\s+command:/.test(entryYaml)) {
    failures.push("phase-5-entry-verified.yaml missing phase_4_gate block");
  }
  if (!/verified_at:/.test(entryYaml)) {
    failures.push("phase-5-entry-verified.yaml missing verified_at");
  }

  const forensic = readUtf8("docs/audits/phase-5-zero-debt-forensic-audit.mdoc");
  if (!/auto_fill:\s*false/.test(forensic) || !/verdict:\s*PENDING/.test(forensic)) {
    failures.push("forensic mdoc must stay auto_fill:false and verdict PENDING until 5.6");
  }

  const decisions = readUtf8("docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md");
  for (const token of [
    "DEC-001",
    "DEC-002",
    "DEC-004",
    "withCanonicalTransaction",
    "OUTBOX_RELAY_ENABLED",
    "FOR UPDATE SKIP LOCKED",
  ]) {
    if (!decisions.includes(token)) {
      failures.push(`IMPLEMENTATION-DECISIONS missing ${token}`);
    }
  }

  const boot = readUtf8("docs/phase-5/appendices/BOOT-MANIFEST.yaml");
  if (!/IMPLEMENTATION-DECISIONS\.md/.test(boot)) {
    failures.push("BOOT-MANIFEST must boot-read IMPLEMENTATION-DECISIONS.md");
  }

  const envMatrix = readUtf8("docs/phase-5/appendices/env-runtime-matrix.md");
  if (!/OUTBOX_RELAY_ENABLED/.test(envMatrix)) {
    failures.push("env-runtime-matrix must document OUTBOX_RELAY_ENABLED");
  }

  if (failures.length === 0) {
    hints.push("doc_execution_system_target: 96");
    hints.push("composite_doc_system_target: 95");
  }

  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join("; ") : null,
    score_hints: hints,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = evaluatePhase5DocHardening();
  if (!r.ok) {
    console.error(`phase-5-doc-hardening: FAIL — ${r.detail}`);
    process.exit(1);
  }
  console.log(`phase-5-doc-hardening: PASS (${r.score_hints.join(", ")})`);
}
