#!/usr/bin/env node
/**
 * NN-06 / B4 — outbox relay in-flight monitor + Prometheus + alert rules.
 * @see docs/phase-5/appendices/outbox-relay-monitor.md
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

const monitorDoc = path.join(REPO_ROOT, "docs/phase-5/appendices/outbox-relay-monitor.md");
if (!fs.existsSync(monitorDoc)) {
  violations.push("missing docs/phase-5/appendices/outbox-relay-monitor.md");
}

for (const rel of [
  "src/outbox/outbox-relay-monitor.ts",
  "src/outbox/outbox-relay-monitor.spec.ts",
]) {
  if (!fs.existsSync(path.join(API_ROOT, rel))) {
    violations.push(`missing ${rel}`);
  }
}

const budget = readApi("src/outbox/outbox-relay-tenant-budget.ts");
if (!budget.includes("getOutboxRelayInFlightSnapshot")) {
  violations.push("outbox-relay-tenant-budget.ts must export getOutboxRelayInFlightSnapshot");
}

const prom = readApi("src/observability/prometheus-format.ts");
for (const metric of [
  "outbox_relay_in_flight_total",
  "outbox_relay_in_flight_max_per_tenant",
  "outbox_relay_tenants_active",
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
  if (!alerts.includes("AppTourOutboxRelayInFlightHigh")) {
    violations.push(`${alertsPath} must define AppTourOutboxRelayInFlightHigh`);
  }
  if (!alerts.includes("AppTourOutboxRelayInFlightSkew")) {
    violations.push(`${alertsPath} must define AppTourOutboxRelayInFlightSkew`);
  }
  if (!alerts.includes("AppTourOutboxRelayDeferredBursts")) {
    violations.push(`${alertsPath} must define AppTourOutboxRelayDeferredBursts`);
  }
  if (!alerts.includes("outbox_relay_in_flight_max_per_tenant")) {
    violations.push(`${alertsPath} must reference outbox_relay_in_flight_max_per_tenant`);
  }
  if (!alerts.includes("outbox_relay_tenant_deferred_total")) {
    violations.push(`${alertsPath} must reference outbox_relay_tenant_deferred_total`);
  }
}

const phase3Audit = readApi("docs/phase3-scalability-stress-audit.md");
if (!phase3Audit.includes("outbox-relay-monitor.md")) {
  violations.push("phase3-scalability-stress-audit.md must link outbox-relay-monitor.md");
}

const fairnessDoc = readRepo("docs/phase-5/appendices/outbox-relay-fairness.md");
if (!fairnessDoc.includes("outbox-relay-monitor")) {
  violations.push("outbox-relay-fairness.md must reference outbox-relay-monitor (B4)");
}

if (violations.length > 0) {
  console.error("guard:outbox-relay-monitor: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:outbox-relay-monitor: PASS");
