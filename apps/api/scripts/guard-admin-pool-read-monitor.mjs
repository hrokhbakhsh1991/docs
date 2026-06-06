#!/usr/bin/env node
/**
 * NN-03 / B1 — admin pool read latency monitor + Prometheus + alert rules.
 * @see docs/phase-5/appendices/admin-pool-read-monitor.md
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
  "src/tenant/admin-pool-read-monitor.ts",
  "src/tenant/admin-pool-read-monitor.spec.ts",
]) {
  if (!fs.existsSync(path.join(API_ROOT, rel))) {
    violations.push(`missing ${rel}`);
  }
}

const resolver = readApi("src/tenant/resolve-registered-tenant.ts");
for (const fn of [
  "recordAdminPoolRead",
  "recordTenantRegistryCacheHit",
  "recordTenantRegistryCacheMiss",
]) {
  if (!resolver.includes(fn)) {
    violations.push(`resolve-registered-tenant.ts must call ${fn}`);
  }
}

const prom = readApi("src/observability/prometheus-format.ts");
for (const metric of [
  "admin_pool_read_duration_ms_last",
  "admin_pool_read_p99_ms",
  "admin_pool_read_slow_total",
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
  if (!alerts.includes("AppTourAdminPoolReadLatencyHigh")) {
    violations.push(`${alertsPath} must define AppTourAdminPoolReadLatencyHigh`);
  }
  if (!alerts.includes("admin_pool_read_p99_ms")) {
    violations.push(`${alertsPath} must reference admin_pool_read_p99_ms`);
  }
  if (!alerts.includes("AppTourAdminPoolReadSlowBursts")) {
    violations.push(`${alertsPath} must define AppTourAdminPoolReadSlowBursts`);
  }
  if (!alerts.includes("admin_pool_read_slow_total")) {
    violations.push(`${alertsPath} must reference admin_pool_read_slow_total`);
  }
}

const monitorDoc = path.join(REPO_ROOT, "docs/phase-5/appendices/admin-pool-read-monitor.md");
if (!fs.existsSync(monitorDoc)) {
  violations.push("missing docs/phase-5/appendices/admin-pool-read-monitor.md");
}

const phase3Audit = readApi("docs/phase3-scalability-stress-audit.md");
if (!phase3Audit.includes("admin-pool-read-monitor.md")) {
  violations.push("phase3-scalability-stress-audit.md must link admin-pool-read-monitor.md");
}

if (violations.length > 0) {
  console.error("guard:admin-pool-read-monitor: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:admin-pool-read-monitor: PASS");
