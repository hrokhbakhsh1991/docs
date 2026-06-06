#!/usr/bin/env node
/**
 * DEC-119 — ci:integrity extends past phase-3.
 * @see docs/phase-5/appendices/ci-integrity-phase-extension.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const violations = [];

const scriptPath = path.join(REPO_ROOT, "scripts/ci-integrity-check.sh");
if (!fs.existsSync(scriptPath)) {
  violations.push("scripts/ci-integrity-check.sh must exist");
} else {
  const sh = fs.readFileSync(scriptPath, "utf8");
  if (!sh.includes("phase-4:guard")) {
    violations.push("ci-integrity-check.sh must run phase-4:guard");
  }
  if (!sh.includes("phase-5:evolution-gate")) {
    violations.push("ci-integrity-check.sh must run @apps/api phase-5:evolution-gate");
  }
  if (sh.includes("PASS (phases 0–3)") && !sh.includes("phase-4")) {
    violations.push("ci-integrity PASS message must reflect phase-4 extension");
  }
}

const docPath = path.join(REPO_ROOT, "docs/phase-5/appendices/ci-integrity-phase-extension.md");
if (!fs.existsSync(docPath)) {
  violations.push("docs/phase-5/appendices/ci-integrity-phase-extension.md must exist");
}

if (violations.length > 0) {
  console.error("guard-ci-integrity-extension: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-ci-integrity-extension: PASS");
