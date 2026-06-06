#!/usr/bin/env node
/**
 * Phase 7 — anti-hollow documentation contract.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

function readUtf8(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

export function evaluateAntiHollowPhase7() {
  const failures = [];
  const required = [
    "docs/phase-7/appendices/anti-hollow-contract.md",
    "docs/phase-7/audits/DOC-EXECUTION-SCORECARD.md",
    "docs/phase-7/appendices/test-matrix.md",
    "docs/phase-7/audits/IMPLEMENTATION-TRUTH.md",
  ];
  for (const p of required) {
    if (!exists(p)) failures.push(`missing ${p}`);
  }

  const anti = readUtf8("docs/phase-7/appendices/anti-hollow-contract.md");
  if (!/scaffold_contract_warning/.test(anti)) {
    failures.push("anti-hollow missing scaffold_contract_warning");
  }
  if (!/96 doc/.test(anti)) {
    failures.push("anti-hollow must document 96 doc target");
  }

  const truth = readUtf8("docs/phase-7/audits/IMPLEMENTATION-TRUTH.md");
  if (!/ABSENT|absent/i.test(truth) || !/SPEC_ONLY/.test(truth)) {
    failures.push("IMPLEMENTATION-TRUTH must stay honest about absent/SPEC_ONLY");
  }

  const scorecard = readUtf8("docs/phase-7/audits/DOC-EXECUTION-SCORECARD.md");
  if (!/Doc execution system.*\*\*96\*\*/.test(scorecard)) {
    failures.push("DOC-EXECUTION-SCORECARD must claim 96 doc execution system");
  }

  return { ok: failures.length === 0, detail: failures.length ? failures.join("; ") : null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = evaluateAntiHollowPhase7();
  if (!r.ok) {
    console.error(`anti-hollow-phase7: FAIL — ${r.detail}`);
    process.exit(1);
  }
  console.log("anti-hollow-phase7: PASS");
}
