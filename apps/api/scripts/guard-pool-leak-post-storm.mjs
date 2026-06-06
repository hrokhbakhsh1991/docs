#!/usr/bin/env node
/**
 * A4 — pool leak post-500 storm monitor contract.
 * @see docs/phase-5/appendices/pool-leak-post-storm-monitor.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(ROOT, "../..");
const violations = [];

function readApi(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function readRepo(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

const monitorDoc = path.join(REPO_ROOT, "docs/phase-5/appendices/pool-leak-post-storm-monitor.md");
if (!fs.existsSync(monitorDoc)) {
  violations.push("missing docs/phase-5/appendices/pool-leak-post-storm-monitor.md");
}

for (const rel of [
  "src/db/pool-saturation-monitor.ts",
  "src/db/pool-saturation-monitor.spec.ts",
  "scripts/pool-stress-500-nightly-probe.mjs",
]) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    violations.push(`missing ${rel}`);
  }
}

const interceptor = readApi("src/middleware/error-interceptor.ts");
if (!interceptor.includes("recordDbPoolSaturatedResponse")) {
  violations.push("error-interceptor.ts must record db_pool_saturated_total on pool 503");
}

const stressScript = readApi("scripts/pool-stress-500-parallel.ts");
if (!stressScript.includes("connectionLeakSuspected")) {
  violations.push("pool-stress-500-parallel.ts must define connectionLeakSuspected leak check");
}

const nightlyProbe = readApi("scripts/pool-stress-500-nightly-probe.mjs");
if (!nightlyProbe.includes("connectionLeakSuspected")) {
  violations.push("pool-stress-500-nightly-probe.mjs must fail on connectionLeakSuspected");
}

const pkg = JSON.parse(readApi("package.json"));
if (!pkg.scripts?.["guard:pool-leak-post-storm"]) {
  violations.push("package.json must define guard:pool-leak-post-storm");
}
if (!pkg.scripts?.["test:nightly:pool-stress-500"]) {
  violations.push("package.json must define test:nightly:pool-stress-500");
}

const phase3Gate = readApi("scripts/phase-3-regression-gate.mjs");
if (!phase3Gate.includes("guard:pool-leak-post-storm")) {
  violations.push("phase-3-regression-gate.mjs must run guard:pool-leak-post-storm");
}

const alertsPath = "deploy/alerts/phase5-slo.yaml";
if (!fs.existsSync(path.join(REPO_ROOT, alertsPath))) {
  violations.push(`${alertsPath} must exist`);
} else {
  const alerts = readRepo(alertsPath);
  if (!alerts.includes("AppTourDbPoolSaturationStorm")) {
    violations.push(`${alertsPath} must define AppTourDbPoolSaturationStorm`);
  }
  if (!alerts.includes("db_pool_saturated_total")) {
    violations.push(`${alertsPath} must reference db_pool_saturated_total`);
  }
}

const phase3Audit = readApi("docs/phase3-scalability-stress-audit.md");
if (!phase3Audit.includes("pool-leak-post-storm-monitor.md")) {
  violations.push("phase3-scalability-stress-audit.md must link pool-leak-post-storm-monitor.md");
}

if (violations.length > 0) {
  console.error("guard:pool-leak-post-storm: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:pool-leak-post-storm: PASS");
