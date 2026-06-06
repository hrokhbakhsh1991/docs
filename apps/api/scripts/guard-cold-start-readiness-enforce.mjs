#!/usr/bin/env node
/**
 * DEC-061 nightly enforce lock — compiled cold-start p95 hard-fail (not trunk regression gate).
 * @see docs/phase-5/appendices/cold-start-lazy-boot.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(ROOT, "../..");
const SCRIPT = path.join(ROOT, "scripts/cold-start-readiness-gate.mjs");
const GATE = path.join(ROOT, "scripts/phase-3-regression-gate.mjs");
const PKG = path.join(ROOT, "package.json");
const WORKFLOW = path.join(REPO_ROOT, ".github/workflows/api-nightly.yml");
const violations = [];

if (!fs.existsSync(SCRIPT)) {
  violations.push("missing scripts/cold-start-readiness-gate.mjs");
} else {
  const source = fs.readFileSync(SCRIPT, "utf8");
  if (!source.includes("COLD_START_READINESS_ENFORCE")) {
    violations.push("cold-start-readiness-gate.mjs must honor COLD_START_READINESS_ENFORCE");
  }
}

const gateSource = fs.readFileSync(GATE, "utf8");
if (!gateSource.includes('COLD_START_READINESS_ENFORCE: "false"')) {
  violations.push(
    "phase-3-regression-gate.mjs must keep COLD_START_READINESS_ENFORCE=false (trunk record-only)"
  );
}

const pkg = JSON.parse(fs.readFileSync(PKG, "utf8"));
const nightlyScript = pkg.scripts?.["test:nightly:cold-start"];
if (!nightlyScript) {
  violations.push("package.json must define test:nightly:cold-start script");
} else {
  if (!nightlyScript.includes("guard:cold-start-readiness-enforce")) {
    violations.push("test:nightly:cold-start must run guard:cold-start-readiness-enforce");
  }
  if (!nightlyScript.includes("COLD_START_READINESS_ENFORCE=true")) {
    violations.push("test:nightly:cold-start must set COLD_START_READINESS_ENFORCE=true");
  }
  if (!nightlyScript.includes("cold-start-readiness-gate")) {
    violations.push("test:nightly:cold-start must invoke cold-start-readiness-gate");
  }
}

if (!fs.existsSync(WORKFLOW)) {
  violations.push(".github/workflows/api-nightly.yml must exist for nightly enforce");
} else {
  const workflow = fs.readFileSync(WORKFLOW, "utf8");
  if (!workflow.includes("test:nightly:cold-start")) {
    violations.push("api-nightly.yml must run test:nightly:cold-start");
  }
}

if (violations.length > 0) {
  console.error("guard:cold-start-readiness-enforce: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard:cold-start-readiness-enforce: PASS");
