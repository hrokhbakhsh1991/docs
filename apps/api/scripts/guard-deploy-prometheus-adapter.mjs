#!/usr/bin/env node
/**
 * DEC-121 — ServiceMonitor + prometheus-adapter rules + HPA metric names in app.
 * @see docs/phase-5/appendices/prometheus-servicemonitor-adapter.md
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

const serviceMonitorPath = "deploy/prometheus/api-servicemonitor.yaml";
const adapterRulesPath = "deploy/prometheus/adapter-rules.yaml";
const docPath = "docs/phase-5/appendices/prometheus-servicemonitor-adapter.md";

for (const rel of [serviceMonitorPath, adapterRulesPath, docPath]) {
  if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

if (violations.length === 0) {
  const sm = readFromRepo(serviceMonitorPath);
  if (!sm.includes("kind: ServiceMonitor")) {
    violations.push(`${serviceMonitorPath} must define ServiceMonitor`);
  }
  if (!sm.includes("/internal/metrics")) {
    violations.push(`${serviceMonitorPath} must scrape /internal/metrics`);
  }
  if (!sm.includes("bearerTokenSecret")) {
    violations.push(`${serviceMonitorPath} must use bearerTokenSecret for prod JWT scrape`);
  }

  const adapter = readFromRepo(adapterRulesPath);
  if (!adapter.includes("http_requests_in_flight")) {
    violations.push(`${adapterRulesPath} must map http_requests_in_flight`);
  }
  if (!adapter.includes("outbox_pending_total")) {
    violations.push(`${adapterRulesPath} must map outbox_pending_total`);
  }
  if (!adapter.includes("outbox_relay_oldest_pending_age_seconds")) {
    violations.push(`${adapterRulesPath} must map outbox_relay_oldest_pending_age_seconds (F2)`);
  }
}

const promFmt = readFromApi("src/observability/prometheus-format.ts");
if (!promFmt.includes("http_requests_in_flight")) {
  violations.push("prometheus-format.ts must export http_requests_in_flight");
}
if (!promFmt.includes("outbox_pending_total")) {
  violations.push("prometheus-format.ts must export outbox_pending_total");
}
if (!promFmt.includes("outbox_relay_oldest_pending_age_seconds")) {
  violations.push("prometheus-format.ts must export outbox_relay_oldest_pending_age_seconds (F2)");
}

const metricsRoute = readFromApi("src/routes/internal/metrics.ts");
if (!metricsRoute.includes("OPS_SCOPE_METRICS_READ")) {
  violations.push("metrics.ts must gate production scrape with metrics:read JWT");
}

if (!fs.existsSync(path.join(API_ROOT, "src/internal/verify-ops-service-jwt.ts"))) {
  violations.push("src/internal/verify-ops-service-jwt.ts must exist");
}

if (violations.length > 0) {
  console.error("guard-deploy-prometheus-adapter: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-deploy-prometheus-adapter: PASS");
