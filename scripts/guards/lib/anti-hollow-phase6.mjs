#!/usr/bin/env node
/**
 * Phase 6 — anti-hollow documentation contract (file presence + honesty tokens).
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

export function evaluateAntiHollowPhase6() {
  const failures = [];
  const required = [
    "docs/phase-6/appendices/anti-hollow-contract.md",
    "docs/phase-6/audits/DOC-EXECUTION-SCORECARD.md",
    "docs/phase-6/appendices/test-matrix.md",
    "docs/phase-6/audits/IMPLEMENTATION-TRUTH.md",
  ];
  for (const p of required) {
    if (!exists(p)) failures.push(`missing ${p}`);
  }

  const anti = readUtf8("docs/phase-6/appendices/anti-hollow-contract.md");
  if (!/scaffold_contract_warning/.test(anti)) {
    failures.push("anti-hollow missing scaffold_contract_warning");
  }
  if (!/96 doc/.test(anti)) {
    failures.push("anti-hollow must document 96 doc target");
  }

  const truth = readUtf8("docs/phase-6/audits/IMPLEMENTATION-TRUTH.md");
  if (!/probe/i.test(truth) || !/SPEC_ONLY/.test(truth)) {
    failures.push("IMPLEMENTATION-TRUTH must stay honest about probe/SPEC_ONLY");
  }

  const scorecard = readUtf8("docs/phase-6/audits/DOC-EXECUTION-SCORECARD.md");
  if (!/Doc execution system.*\*\*96\*\*/.test(scorecard)) {
    failures.push("DOC-EXECUTION-SCORECARD must claim 96 doc execution system");
  }

  return { ok: failures.length === 0, detail: failures.length ? failures.join("; ") : null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = evaluateAntiHollowPhase6();
  if (!r.ok) {
    console.error(`anti-hollow-phase6: FAIL — ${r.detail}`);
    process.exit(1);
  }
  console.log("anti-hollow-phase6: PASS");
}
