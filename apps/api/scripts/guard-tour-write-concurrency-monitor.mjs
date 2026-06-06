#!/usr/bin/env node
/**
 * NN-05 / B3 — tour write concurrency in-flight monitor + Prometheus + alert rules.
 * @see docs/phase-5/appendices/tour-write-concurrency-monitor.md
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

const monitorDoc = path.join(
  REPO_ROOT,
  "docs/phase-5/appendices/tour-write-concurrency-monitor.md"
);
if (!fs.existsSync(monitorDoc)) {
  violations.push("missing docs/phase-5/appendices/tour-write-concurrency-monitor.md");
}

for (const rel of [
  "src/http/tour-write-concurrency-monitor.ts",
  "src/http/tour-write-concurrency-monitor.spec.ts",
]) {
  if (!fs.existsSync(path.join(API_ROOT, rel))) {
    violations.push(`missing ${rel}`);
  }
}

const budget = readApi("src/http/tour-write-concurrency-budget.ts");
if (!budget.includes("getTourWriteInFlightSnapshot")) {
  violations.push("tour-write-concurrency-budget.ts must export getTourWriteInFlightSnapshot");
}

const prom = readApi("src/observability/prometheus-format.ts");
for (const metric of [
  "tour_write_in_flight_total",
  "tour_write_in_flight_max_per_tenant",
  "tour_write_tenants_active",
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
  if (!alerts.includes("AppTourTourWriteInFlightHigh")) {
    violations.push(`${alertsPath} must define AppTourTourWriteInFlightHigh`);
  }
  if (!alerts.includes("AppTourTourWriteInFlightSkew")) {
    violations.push(`${alertsPath} must define AppTourTourWriteInFlightSkew`);
  }
  if (!alerts.includes("AppTourTourWriteConcurrencyShedBursts")) {
    violations.push(`${alertsPath} must define AppTourTourWriteConcurrencyShedBursts`);
  }
  if (!alerts.includes("tour_write_in_flight_max_per_tenant")) {
    violations.push(`${alertsPath} must reference tour_write_in_flight_max_per_tenant`);
  }
  if (!alerts.includes("tour_write_concurrency_shed_total")) {
    violations.push(`${alertsPath} must reference tour_write_concurrency_shed_total`);
  }
}

const phase3Audit = readApi("docs/phase3-scalability-stress-audit.md");
if (!phase3Audit.includes("tour-write-concurrency-monitor.md")) {
  violations.push("phase3-scalability-stress-audit.md must link tour-write-concurrency-monitor.md");
}

const concurrencyDoc = readRepo("docs/phase-5/appendices/tour-write-concurrency.md");
if (!concurrencyDoc.includes("tour-write-concurrency-monitor")) {
  violations.push("tour-write-concurrency.md must reference tour-write-concurrency-monitor (B3)");
}

if (violations.length > 0) {
  console.error("guard:tour-write-concurrency-monitor: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:tour-write-concurrency-monitor: PASS");
