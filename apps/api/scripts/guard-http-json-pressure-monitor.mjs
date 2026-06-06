#!/usr/bin/env node
/**
 * NN-07 / B5 — HTTP JSON ingress/egress reject monitor + Prometheus + alert rules.
 * @see docs/phase-5/appendices/http-json-pressure-monitor.md
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

const monitorDoc = path.join(REPO_ROOT, "docs/phase-5/appendices/http-json-pressure-monitor.md");
if (!fs.existsSync(monitorDoc)) {
  violations.push("missing docs/phase-5/appendices/http-json-pressure-monitor.md");
}

for (const rel of [
  "src/http/http-json-pressure-monitor.ts",
  "src/http/http-json-pressure-monitor.spec.ts",
]) {
  if (!fs.existsSync(path.join(API_ROOT, rel))) {
    violations.push(`missing ${rel}`);
  }
}

const interceptor = readApi("src/middleware/error-interceptor.ts");
if (!interceptor.includes("recordHttpRequestBodyRejected")) {
  violations.push("error-interceptor.ts must record http_request_body_rejected_total on 413");
}
if (!interceptor.includes("recordHttpResponseBodyRejected")) {
  violations.push("error-interceptor.ts must record http_response_body_rejected_total on 507");
}

const prom = readApi("src/observability/prometheus-format.ts");
for (const metric of ["http_request_body_rejected_total", "http_response_body_rejected_total"]) {
  if (!prom.includes(metric)) {
    violations.push(`prometheus-format.ts must export ${metric}`);
  }
}

const alertsPath = "deploy/alerts/phase5-slo.yaml";
if (!fs.existsSync(path.join(REPO_ROOT, alertsPath))) {
  violations.push(`${alertsPath} must exist`);
} else {
  const alerts = readRepo(alertsPath);
  if (!alerts.includes("AppTourHttpRequestBodyRejectedBursts")) {
    violations.push(`${alertsPath} must define AppTourHttpRequestBodyRejectedBursts`);
  }
  if (!alerts.includes("AppTourHttpResponseBodyRejectedBursts")) {
    violations.push(`${alertsPath} must define AppTourHttpResponseBodyRejectedBursts`);
  }
  if (!alerts.includes("http_request_body_rejected_total")) {
    violations.push(`${alertsPath} must reference http_request_body_rejected_total`);
  }
  if (!alerts.includes("http_response_body_rejected_total")) {
    violations.push(`${alertsPath} must reference http_response_body_rejected_total`);
  }
}

const phase3Audit = readApi("docs/phase3-scalability-stress-audit.md");
if (!phase3Audit.includes("http-json-pressure-monitor.md")) {
  violations.push("phase3-scalability-stress-audit.md must link http-json-pressure-monitor.md");
}

const bodyLimitDoc = readRepo("docs/phase-5/appendices/http-request-body-limit.md");
if (!bodyLimitDoc.includes("http-json-pressure-monitor")) {
  violations.push("http-request-body-limit.md must reference http-json-pressure-monitor (B5)");
}

if (violations.length > 0) {
  console.error("guard:http-json-pressure-monitor: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:http-json-pressure-monitor: PASS");
