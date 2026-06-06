#!/usr/bin/env node
/**
 * OB-COND-03 / C3 + OB-COND-04 / C4 — relay tick skip + throughput monitor.
 * @see docs/phase-5/appendices/outbox-relay-tick-monitor.md
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

const monitorDoc = path.join(REPO_ROOT, "docs/phase-5/appendices/outbox-relay-tick-monitor.md");
if (!fs.existsSync(monitorDoc)) {
  violations.push("missing docs/phase-5/appendices/outbox-relay-tick-monitor.md");
}

for (const rel of [
  "src/outbox/outbox-relay-tick-monitor.ts",
  "src/outbox/outbox-relay-tick-monitor.spec.ts",
]) {
  if (!fs.existsSync(path.join(API_ROOT, rel))) {
    violations.push(`missing ${rel}`);
  }
}

const startRelay = readApi("src/outbox/start-outbox-relay.ts");
if (!startRelay.includes("recordOutboxRelayTickSkipped")) {
  violations.push(
    "start-outbox-relay.ts must call recordOutboxRelayTickSkipped when running guard skips"
  );
}

const relay = readApi("src/outbox/outbox-relay.ts");
if (!relay.includes("recordOutboxRelayTickResult")) {
  violations.push(
    "outbox-relay.ts must call recordOutboxRelayTickResult after publishClaimedBatch"
  );
}

const prom = readApi("src/observability/prometheus-format.ts");
for (const metric of [
  "outbox_relay_tick_skipped_total",
  "outbox_relay_published_total",
  "outbox_relay_published_last_tick",
  "outbox_relay_failed_last_tick",
  "outbox_relay_deferred_last_tick",
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
  if (!alerts.includes("AppTourOutboxRelayTickSkippedBursts")) {
    violations.push(`${alertsPath} must define AppTourOutboxRelayTickSkippedBursts`);
  }
  if (!alerts.includes("AppTourOutboxRelayPublishStalled")) {
    violations.push(`${alertsPath} must define AppTourOutboxRelayPublishStalled`);
  }
  if (!alerts.includes("outbox_relay_tick_skipped_total")) {
    violations.push(`${alertsPath} must reference outbox_relay_tick_skipped_total`);
  }
  if (!alerts.includes("outbox_relay_published_total")) {
    violations.push(`${alertsPath} must reference outbox_relay_published_total`);
  }
}

const phase3Audit = readApi("docs/phase3-scalability-stress-audit.md");
if (!phase3Audit.includes("outbox-relay-tick-monitor.md")) {
  violations.push("phase3-scalability-stress-audit.md must link outbox-relay-tick-monitor.md");
}

const relayMonitorDoc = readRepo("docs/phase-5/appendices/outbox-relay-monitor.md");
if (!relayMonitorDoc.includes("outbox-relay-tick-monitor")) {
  violations.push("outbox-relay-monitor.md must reference outbox-relay-tick-monitor (C3/C4)");
}

if (violations.length > 0) {
  console.error("guard:outbox-relay-tick-monitor: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:outbox-relay-tick-monitor: PASS");
