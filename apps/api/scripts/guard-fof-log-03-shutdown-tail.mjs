#!/usr/bin/env node
/**
 * FOF-LOG-03 / A3 — shutdown log flush contract + production slow-sink gate.
 * @see docs/phase-5/appendices/fof-log-03-shutdown-tail-acceptance.md
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

const acceptanceDoc = path.join(
  REPO_ROOT,
  "docs/phase-5/appendices/fof-log-03-shutdown-tail-acceptance.md"
);
if (!fs.existsSync(acceptanceDoc)) {
  violations.push("missing docs/phase-5/appendices/fof-log-03-shutdown-tail-acceptance.md");
}

const shutdown = readApi("src/server/graceful-shutdown.ts");
if (!shutdown.includes("drainHttpRequestLogQueueSync")) {
  violations.push("graceful-shutdown.ts must drain access-log queue on SIGTERM");
}
if (!shutdown.includes("await flushLogSink()")) {
  violations.push("graceful-shutdown.ts must await flushLogSink after HTTP close");
}

const logger = readApi("src/observability/logger.ts");
if (!logger.includes("log_shutdown_flush_timed_out_total")) {
  violations.push("logger.ts flushLogSink must record log_shutdown_flush_timed_out_total");
}
if (!logger.includes("log_shutdown_flush_total")) {
  violations.push("logger.ts flushLogSink must record log_shutdown_flush_total");
}

const prom = readApi("src/observability/prometheus-format.ts");
for (const metric of [
  "log_shutdown_flush_timed_out_total",
  "log_sink_drop_total",
  "log_shutdown_flush_total",
]) {
  if (!prom.includes(metric)) {
    violations.push(`prometheus-format.ts must export ${metric}`);
  }
}

const pkg = JSON.parse(readApi("package.json"));
if (!pkg.scripts?.["test:nightly:slow-sink"]) {
  violations.push("package.json must define test:nightly:slow-sink (DEC-070)");
}

const deployChecklist = readRepo("docs/phase-4/production-deploy-checklist.md");
if (!deployChecklist.includes("test:nightly:slow-sink")) {
  violations.push("production-deploy-checklist.md must require slow-sink before remote log driver");
}

const alertsPath = path.join(REPO_ROOT, "deploy/alerts/phase5-slo.yaml");
if (!fs.existsSync(alertsPath)) {
  violations.push("deploy/alerts/phase5-slo.yaml must exist");
} else {
  const alerts = fs.readFileSync(alertsPath, "utf8");
  if (!alerts.includes("AppTourLogShutdownFlushTimeout")) {
    violations.push("phase5-slo.yaml must alert on log_shutdown_flush_timed_out_total");
  }
}

const backpressureDoc = readRepo("docs/phase-5/appendices/logging-backpressure.md");
if (!backpressureDoc.includes("FOF-LOG-03")) {
  violations.push("logging-backpressure.md must reference FOF-LOG-03");
}

if (violations.length > 0) {
  console.error("guard:fof-log-03-shutdown-tail: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:fof-log-03-shutdown-tail: PASS");
