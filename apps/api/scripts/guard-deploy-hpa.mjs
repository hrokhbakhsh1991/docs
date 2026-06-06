#!/usr/bin/env node
/**
 * DEC-122 — HPA manifests wired to DEC-121 custom metrics + Argo Rollout.
 * @see docs/phase-5/appendices/api-hpa-custom-metrics.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

const apiHpaPath = "deploy/hpa/api-hpa.yaml";
const relayHpaPath = "deploy/hpa/outbox-relay-hpa.yaml";
const adapterPath = "deploy/prometheus/adapter-rules.yaml";
const docPath = "docs/phase-5/appendices/api-hpa-custom-metrics.md";

for (const rel of [apiHpaPath, relayHpaPath, docPath, adapterPath]) {
  if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

if (violations.length === 0) {
  const apiHpa = read(apiHpaPath);
  if (!apiHpa.includes("kind: HorizontalPodAutoscaler")) {
    violations.push(`${apiHpaPath} must define HorizontalPodAutoscaler`);
  }
  if (!apiHpa.includes("kind: Rollout") || !apiHpa.includes("name: api")) {
    violations.push(`${apiHpaPath} must target Argo Rollout api`);
  }
  if (!apiHpa.includes("http_requests_in_flight")) {
    violations.push(`${apiHpaPath} must scale on http_requests_in_flight`);
  }
  if (!apiHpa.includes("outbox_pending_total")) {
    violations.push(`${apiHpaPath} must scale on outbox_pending_total`);
  }

  const relayHpa = read(relayHpaPath);
  if (!relayHpa.includes("name: outbox-relay")) {
    violations.push(`${relayHpaPath} must target Deployment outbox-relay`);
  }
  if (!relayHpa.includes("outbox_pending_total")) {
    violations.push(`${relayHpaPath} must scale relay on outbox_pending_total`);
  }
  if (!relayHpa.includes("outbox_relay_oldest_pending_age_seconds")) {
    violations.push(
      `${relayHpaPath} must scale relay on outbox_relay_oldest_pending_age_seconds (F2)`
    );
  }

  const adapter = read(adapterPath);
  for (const metric of [
    "http_requests_in_flight",
    "outbox_pending_total",
    "outbox_relay_oldest_pending_age_seconds",
  ]) {
    if (!adapter.includes(metric)) {
      violations.push(`adapter-rules.yaml must define ${metric} for HPA (DEC-121)`);
    }
  }

  if (!apiHpa.includes("outbox_relay_oldest_pending_age_seconds")) {
    violations.push(
      `${apiHpaPath} must scale colocated relay on outbox_relay_oldest_pending_age_seconds (F2)`
    );
  }
}

if (violations.length > 0) {
  console.error("guard-deploy-hpa: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-deploy-hpa: PASS");
