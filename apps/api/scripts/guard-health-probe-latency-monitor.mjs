#!/usr/bin/env node
/**
 * NN-01 / A1 — health probe latency monitor + Prometheus + alert rules.
 * @see docs/phase-5/appendices/health-probe-latency-monitor.md
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

for (const rel of [
  "src/health/health-probe-latency.ts",
  "src/health/health-probe-latency.spec.ts",
]) {
  if (!fs.existsSync(path.join(API_ROOT, rel))) {
    violations.push(`missing ${rel}`);
  }
}

const healthRoutes = readApi("src/health/health.routes.ts");
if (!healthRoutes.includes("recordHealthProbeDuration")) {
  violations.push("health.routes.ts must record probe duration on finish");
}

const prom = readApi("src/observability/prometheus-format.ts");
for (const metric of [
  "health_probe_duration_ms_last",
  "health_probe_p99_ms",
  "health_probe_slow_total",
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
  if (!alerts.includes("AppTourHealthProbeLatencyHigh")) {
    violations.push(`${alertsPath} must define AppTourHealthProbeLatencyHigh`);
  }
  if (!alerts.includes("health_probe_p99_ms")) {
    violations.push(`${alertsPath} must reference health_probe_p99_ms`);
  }
  if (!alerts.includes("AppTourHealthProbeSlowBursts")) {
    violations.push(`${alertsPath} must define AppTourHealthProbeSlowBursts`);
  }
  if (!alerts.includes("health_probe_slow_total")) {
    violations.push(`${alertsPath} must reference health_probe_slow_total`);
  }
}

if (violations.length > 0) {
  console.error("guard:health-probe-latency-monitor: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:health-probe-latency-monitor: PASS");
