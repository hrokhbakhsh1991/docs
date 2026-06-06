#!/usr/bin/env node
/**
 * DEC-123 — Phase 5 SLO PrometheusRule + outbox_failed_total gauge.
 * @see docs/phase-5/appendices/phase5-slo-alerting.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(API_ROOT, "../..");
const violations = [];

function readFromRepo(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function readFromApi(rel) {
  return fs.readFileSync(path.join(API_ROOT, rel), "utf8");
}

const alertsPath = "deploy/alerts/phase5-slo.yaml";
const docPath = "docs/phase-5/appendices/phase5-slo-alerting.md";

if (!fs.existsSync(path.join(REPO_ROOT, alertsPath))) {
  violations.push(`${alertsPath} must exist`);
}
if (!fs.existsSync(path.join(REPO_ROOT, docPath))) {
  violations.push(docPath);
}

if (violations.length === 0) {
  const rules = readFromRepo(alertsPath);
  if (!rules.includes("kind: PrometheusRule")) {
    violations.push(`${alertsPath} must define PrometheusRule`);
  }
  if (!rules.includes("AppTourOutboxFailedRows")) {
    violations.push(`${alertsPath} must alert on outbox_failed_total`);
  }
  if (!rules.includes("outbox_failed_total")) {
    violations.push(`${alertsPath} expr must reference outbox_failed_total`);
  }
  if (!rules.includes("AppTourProjectionDrift")) {
    violations.push(`${alertsPath} must alert on projection_inconsistency_total`);
  }
  if (!rules.includes("projection_inconsistency_total")) {
    violations.push(`${alertsPath} expr must reference projection_inconsistency_total`);
  }
  if (!rules.includes("AppTourDbCircuitOpen")) {
    violations.push(`${alertsPath} must alert on db_circuit_open`);
  }
  if (!rules.includes("db_circuit_open")) {
    violations.push(`${alertsPath} expr must reference db_circuit_open`);
  }
  if (!rules.includes("AppTourHealthProbeLatencyHigh")) {
    violations.push(`${alertsPath} must alert on health_probe_p99_ms (NN-01 / A1)`);
  }
  if (!rules.includes("health_probe_p99_ms")) {
    violations.push(`${alertsPath} expr must reference health_probe_p99_ms`);
  }
  if (!rules.includes("AppTourLogShutdownFlushTimeout")) {
    violations.push(
      `${alertsPath} must alert on log_shutdown_flush_timed_out_total (FOF-LOG-03 / A3)`
    );
  }
  if (!rules.includes("AppTourDbPoolSaturationStorm")) {
    violations.push(`${alertsPath} must alert on db_pool_saturated_total (A4)`);
  }
  if (!rules.includes("db_pool_saturated_total")) {
    violations.push(`${alertsPath} expr must reference db_pool_saturated_total`);
  }
  if (!rules.includes("AppTourAdminPoolReadLatencyHigh")) {
    violations.push(`${alertsPath} must alert on admin_pool_read_p99_ms (B1 / NN-03)`);
  }
  if (!rules.includes("admin_pool_read_p99_ms")) {
    violations.push(`${alertsPath} expr must reference admin_pool_read_p99_ms`);
  }
  if (!rules.includes("AppTourValidationQueueDepthHigh")) {
    violations.push(`${alertsPath} must alert on validation_queue_depth_total (B2 / NN-04)`);
  }
  if (!rules.includes("AppTourValidationQueueShedBursts")) {
    violations.push(`${alertsPath} must alert on validation_queue_shed_total bursts (B2)`);
  }
  if (!rules.includes("AppTourTourWriteConcurrencyShedBursts")) {
    violations.push(`${alertsPath} must alert on tour_write_concurrency_shed_total (B3 / NN-05)`);
  }
  if (!rules.includes("tour_write_in_flight_total")) {
    violations.push(`${alertsPath} expr must reference tour_write_in_flight_total`);
  }
  if (!rules.includes("AppTourOutboxRelayDeferredBursts")) {
    violations.push(`${alertsPath} must alert on outbox_relay_tenant_deferred_total (B4 / NN-06)`);
  }
  if (!rules.includes("outbox_relay_in_flight_total")) {
    violations.push(`${alertsPath} expr must reference outbox_relay_in_flight_total`);
  }
  if (!rules.includes("AppTourHttpRequestBodyRejectedBursts")) {
    violations.push(`${alertsPath} must alert on http_request_body_rejected_total (B5 / NN-07)`);
  }
  if (!rules.includes("http_request_body_rejected_total")) {
    violations.push(`${alertsPath} expr must reference http_request_body_rejected_total`);
  }
  if (!rules.includes("AppTourOutboxRelayPoolHeadroomNegative")) {
    violations.push(`${alertsPath} must alert on outbox_relay_pool_headroom (C2 / OB-COND-02)`);
  }
  if (!rules.includes("outbox_relay_pool_headroom")) {
    violations.push(`${alertsPath} expr must reference outbox_relay_pool_headroom`);
  }
}

const promFmt = readFromApi("src/observability/prometheus-format.ts");
if (!promFmt.includes("outbox_failed_total")) {
  violations.push("prometheus-format.ts must export outbox_failed_total (DEC-123)");
}

const queueCounts = readFromApi("src/outbox/outbox-queue-counts.ts");
if (!queueCounts.includes("countFailedOutboxRows")) {
  violations.push("outbox-queue-counts.ts must define countFailedOutboxRows");
}

if (violations.length > 0) {
  console.error("guard-deploy-phase5-slo-alerts: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-deploy-phase5-slo-alerts: PASS");
