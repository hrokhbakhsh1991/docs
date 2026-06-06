#!/usr/bin/env node
/**
 * F1 + F2 — relay lag gauge, alerts, and HPA/adapter wiring.
 * @see docs/phase-5/appendices/outbox-relay-lag-monitor.md
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

const monitorDoc = path.join(REPO_ROOT, "docs/phase-5/appendices/outbox-relay-lag-monitor.md");
if (!fs.existsSync(monitorDoc)) {
  violations.push("missing docs/phase-5/appendices/outbox-relay-lag-monitor.md");
}

for (const rel of [
  "src/outbox/outbox-relay-lag-monitor.ts",
  "src/outbox/outbox-relay-lag-monitor.spec.ts",
]) {
  if (!fs.existsSync(path.join(API_ROOT, rel))) {
    violations.push(`missing ${rel}`);
  }
}

const queueCounts = readApi("src/outbox/outbox-queue-counts.ts");
if (!queueCounts.includes("queryOldestPendingOutboxCreatedAt")) {
  violations.push("outbox-queue-counts.ts must export queryOldestPendingOutboxCreatedAt");
}

const pendingMetrics = readApi("src/outbox/outbox-pending-metrics.ts");
if (!pendingMetrics.includes("refreshOutboxRelayLagFromDb")) {
  violations.push("outbox-pending-metrics.ts must refresh relay lag on queue gauge refresh");
}

const prom = readApi("src/observability/prometheus-format.ts");
if (!prom.includes("outbox_relay_oldest_pending_age_seconds")) {
  violations.push("prometheus-format.ts must export outbox_relay_oldest_pending_age_seconds");
}

const alertsPath = "deploy/alerts/phase5-slo.yaml";
if (!fs.existsSync(path.join(REPO_ROOT, alertsPath))) {
  violations.push(`${alertsPath} must exist`);
} else {
  const alerts = readRepo(alertsPath);
  if (!alerts.includes("AppTourOutboxRelayLagHigh")) {
    violations.push(`${alertsPath} must define AppTourOutboxRelayLagHigh`);
  }
  if (!alerts.includes("outbox_relay_oldest_pending_age_seconds")) {
    violations.push(`${alertsPath} must reference outbox_relay_oldest_pending_age_seconds`);
  }
}

const phase3Audit = readApi("docs/phase3-scalability-stress-audit.md");
if (!phase3Audit.includes("outbox-relay-lag-monitor.md")) {
  violations.push("phase3-scalability-stress-audit.md must link outbox-relay-lag-monitor.md");
}

const relayMonitorDoc = readRepo("docs/phase-5/appendices/outbox-relay-monitor.md");
if (!relayMonitorDoc.includes("outbox-relay-lag-monitor")) {
  violations.push("outbox-relay-monitor.md must reference outbox-relay-lag-monitor (F1)");
}

const hpaDoc = readRepo("docs/phase-5/appendices/api-hpa-custom-metrics.md");
if (!hpaDoc.includes("outbox_relay_oldest_pending_age_seconds")) {
  violations.push("api-hpa-custom-metrics.md must document lag HPA metric (F2)");
}

const relayHpaPath = "deploy/hpa/outbox-relay-hpa.yaml";
if (!fs.existsSync(path.join(REPO_ROOT, relayHpaPath))) {
  violations.push(`${relayHpaPath} must exist`);
} else {
  const relayHpa = readRepo(relayHpaPath);
  if (!relayHpa.includes("outbox_relay_oldest_pending_age_seconds")) {
    violations.push(`${relayHpaPath} must scale on outbox_relay_oldest_pending_age_seconds (F2)`);
  }
}

const adapterPath = "deploy/prometheus/adapter-rules.yaml";
if (!fs.existsSync(path.join(REPO_ROOT, adapterPath))) {
  violations.push(`${adapterPath} must exist`);
} else {
  const adapter = readRepo(adapterPath);
  if (!adapter.includes("outbox_relay_oldest_pending_age_seconds")) {
    violations.push(`${adapterPath} must map outbox_relay_oldest_pending_age_seconds (F2)`);
  }
}

if (violations.length > 0) {
  console.error("guard:outbox-relay-lag-monitor: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:outbox-relay-lag-monitor: PASS");
