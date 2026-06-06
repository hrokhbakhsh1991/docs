#!/usr/bin/env node
/**
 * D1 + D6 — Phase 3 document alignment (CON-01 headline count, CON-06 BASELINE_RATIO tiers).
 * @see docs/phase-5/appendices/baseline-ratio-tiering.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(API_ROOT, "../..");
const violations = [];

function readApi(rel) {
  return fs.readFileSync(path.join(API_ROOT, rel), "utf8");
}

function readRepo(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

const tierDoc = path.join(REPO_ROOT, "docs/phase-5/appendices/baseline-ratio-tiering.md");
if (!fs.existsSync(tierDoc)) {
  violations.push("missing docs/phase-5/appendices/baseline-ratio-tiering.md");
}

const phase3 = readApi("docs/phase3-scalability-stress-audit.md");

if (!phase3.includes("**15** ([SCAL-DEBT-01…15](#scalability-debt))")) {
  violations.push("phase3 headline must show 15 scalability debt (SCAL-DEBT-01…15) — CON-01/D1");
}

if (!phase3.includes("### Document alignment (CON)")) {
  violations.push(
    "phase3-scalability-stress-audit.md must define Document alignment (CON) section"
  );
}

if (!phase3.includes("CON-01") || !phase3.includes("CON-06")) {
  violations.push("Document alignment section must resolve CON-01 and CON-06");
}

if (!phase3.includes("baseline-ratio-tiering.md")) {
  violations.push("phase3-scalability-stress-audit.md must link baseline-ratio-tiering.md (D6)");
}

const validationFairness = readRepo("docs/phase-5/appendices/validation-fairness.md");
if (!validationFairness.includes("baseline-ratio-tiering.md")) {
  violations.push("validation-fairness.md must reference baseline-ratio-tiering.md");
}

const rateLimiting = readRepo("docs/phase-5/appendices/rate-limiting.md");
if (!rateLimiting.includes("baseline-ratio-tiering.md")) {
  violations.push("rate-limiting.md must reference baseline-ratio-tiering.md");
}

const tierContent = readRepo("docs/phase-5/appendices/baseline-ratio-tiering.md");
for (const token of ["1.10", "1.25", "1.30", "CI-BYP-20"]) {
  if (!tierContent.includes(token)) {
    violations.push(`baseline-ratio-tiering.md must document ${token}`);
  }
}

const spec = readApi("test/3-performance/noisy-neighbor-latency.spec.ts");
if (!spec.includes('process.env.BASELINE_RATIO_MAX ?? "1.10"')) {
  violations.push("noisy-neighbor-latency.spec.ts must default BASELINE_RATIO_MAX to 1.10");
}

const rootPkg = readRepo("package.json");
if (!rootPkg.includes("BASELINE_RATIO_MAX=1.25")) {
  violations.push("root package.json phase-5:gate must set BASELINE_RATIO_MAX=1.25");
}

if (violations.length > 0) {
  console.error("guard:phase3-doc-alignment: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:phase3-doc-alignment: PASS");
