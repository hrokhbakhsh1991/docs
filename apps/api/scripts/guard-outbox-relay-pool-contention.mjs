#!/usr/bin/env node
/**
 * OB-COND-02 / C2 — relay publish concurrency vs app pool connection_limit monitor.
 * @see docs/phase-5/appendices/outbox-relay-pool-contention-monitor.md
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
  "docs/phase-5/appendices/outbox-relay-pool-contention-monitor.md"
);
if (!fs.existsSync(monitorDoc)) {
  violations.push("missing docs/phase-5/appendices/outbox-relay-pool-contention-monitor.md");
}

for (const rel of [
  "src/outbox/outbox-relay-pool-contention.ts",
  "src/outbox/outbox-relay-pool-contention.spec.ts",
]) {
  if (!fs.existsSync(path.join(API_ROOT, rel))) {
    violations.push(`missing ${rel}`);
  }
}

const prom = readApi("src/observability/prometheus-format.ts");
for (const metric of [
  "db_pool_connection_limit_config",
  "outbox_relay_publish_concurrency_config",
  "outbox_relay_pool_headroom",
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
  if (!alerts.includes("AppTourOutboxRelayPoolHeadroomNegative")) {
    violations.push(`${alertsPath} must define AppTourOutboxRelayPoolHeadroomNegative`);
  }
  if (!alerts.includes("outbox_relay_pool_headroom")) {
    violations.push(`${alertsPath} must reference outbox_relay_pool_headroom`);
  }
  if (!alerts.includes("AppTourOutboxRelayPoolContentionStorm")) {
    violations.push(`${alertsPath} must define AppTourOutboxRelayPoolContentionStorm`);
  }
}

const phase3Audit = readApi("docs/phase3-scalability-stress-audit.md");
if (!phase3Audit.includes("outbox-relay-pool-contention-monitor.md")) {
  violations.push(
    "phase3-scalability-stress-audit.md must link outbox-relay-pool-contention-monitor.md"
  );
}

const fairnessDoc = readRepo("docs/phase-5/appendices/outbox-relay-fairness.md");
if (!fairnessDoc.includes("outbox-relay-pool-contention")) {
  violations.push("outbox-relay-fairness.md must reference outbox-relay-pool-contention (C2)");
}

const postgresGates = readRepo("docs/phase-5/appendices/postgres-required-gates.md");
if (!postgresGates.includes("connection_limit")) {
  violations.push("postgres-required-gates.md must document connection_limit sizing");
}

if (violations.length > 0) {
  console.error("guard:outbox-relay-pool-contention: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:outbox-relay-pool-contention: PASS");
