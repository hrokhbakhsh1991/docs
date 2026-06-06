#!/usr/bin/env node
/**
 * NN-04 / B2 — validation queue depth/skew monitor + Prometheus + alert rules.
 * @see docs/phase-5/appendices/validation-queue-monitor.md
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

const monitorDoc = path.join(REPO_ROOT, "docs/phase-5/appendices/validation-queue-monitor.md");
if (!fs.existsSync(monitorDoc)) {
  violations.push("missing docs/phase-5/appendices/validation-queue-monitor.md");
}

for (const rel of [
  "src/canonical/validation-queue-monitor.ts",
  "src/canonical/validation-queue-monitor.spec.ts",
]) {
  if (!fs.existsSync(path.join(API_ROOT, rel))) {
    violations.push(`missing ${rel}`);
  }
}

const scheduler = readApi("src/canonical/validation-scheduler.ts");
if (!scheduler.includes("getValidationInFlightTotal")) {
  violations.push("validation-scheduler.ts must export getValidationInFlightTotal");
}

const prom = readApi("src/observability/prometheus-format.ts");
for (const metric of [
  "validation_queue_depth_total",
  "validation_queue_depth_max_per_tenant",
  "validation_queue_tenants_pending",
  "validation_queue_in_flight_total",
]) {
  if (!prom.includes(metric)) {
    violations.push(`prometheus-format.ts must export ${metric}`);
  }
}

const alertsPath = "deploy/alerts/phase5-slo.yaml";
if (!fs.existsSync(path.join(REPO_ROOT, alertsPath))) {
  violations.push(`${alertsPath} must exist`);
} else {
  const alerts = readRepo(alertsPath);
  if (!alerts.includes("AppTourValidationQueueDepthHigh")) {
    violations.push(`${alertsPath} must define AppTourValidationQueueDepthHigh`);
  }
  if (!alerts.includes("AppTourValidationQueueDepthSkew")) {
    violations.push(`${alertsPath} must define AppTourValidationQueueDepthSkew`);
  }
  if (!alerts.includes("AppTourValidationQueueShedBursts")) {
    violations.push(`${alertsPath} must define AppTourValidationQueueShedBursts`);
  }
  if (!alerts.includes("validation_queue_depth_max_per_tenant")) {
    violations.push(`${alertsPath} must reference validation_queue_depth_max_per_tenant`);
  }
  if (!alerts.includes("validation_queue_shed_total")) {
    violations.push(`${alertsPath} must reference validation_queue_shed_total`);
  }
}

const phase3Audit = readApi("docs/phase3-scalability-stress-audit.md");
if (!phase3Audit.includes("validation-queue-monitor.md")) {
  violations.push("phase3-scalability-stress-audit.md must link validation-queue-monitor.md");
}

const fairnessDoc = readRepo("docs/phase-5/appendices/validation-fairness.md");
if (!fairnessDoc.includes("validation-queue-monitor")) {
  violations.push("validation-fairness.md must reference validation-queue-monitor (B2)");
}

if (violations.length > 0) {
  console.error("guard:validation-queue-monitor: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:validation-queue-monitor: PASS");
