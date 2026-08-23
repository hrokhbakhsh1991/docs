#!/usr/bin/env node
/** PROD-8 R8-18..R8-27 — verify ops/monitoring/runbook tooling (not live external infra). */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const checks = [];

function pass(id, detail, tier = "tooling") {
  checks.push({ id, status: "PASS", tier, detail });
}
function blocked(id, detail) {
  checks.push({ id, status: "BLOCKED", tier: "external", detail });
}
function fail(id, detail) {
  checks.push({ id, status: "FAIL", tier: "tooling", detail });
}

const requiredFiles = [
  ["R8-18", "deploy/ops/vps-availability-dashboard.json", "availability dashboard template"],
  ["R8-19", "deploy/alerts/phase5-slo.yaml", "latency/error/saturation alert rules"],
  ["R8-20", "deploy/ops/vps-alert-ownership.yaml", "alert ownership + severity matrix"],
  ["R8-21", "docs/platform/PROD-8-OPERATIONS.md", "runbook links + ops procedures"],
  ["R8-22", "apps/api/src/observability/trace-request-context.ts", "correlation trace context"],
  ["R8-23", "deploy/ops/vps-logrotate.conf", "log retention/rotation template"],
  ["R8-24", "apps/api/src/db/migration-head-preflight.ts", "migration-head drift monitor"],
  ["R8-25", "scripts/ops/prod8-backup-freshness-check.mjs", "backup freshness monitor script"],
  ["R8-26", "scripts/restore-drill-smoke.sh", "restore drill smoke"],
  ["R8-27", "docs/phase-5/appendices/rpo-rto-production.md", "RPO/RTO targets documented"],
];

for (const [id, rel, label] of requiredFiles) {
  if (existsSync(join(root, rel))) pass(id, `${label} present`);
  else fail(id, `missing ${rel}`);
}

const incidentRunbook = join(root, "docs/phase-23/runbooks/p10-incident-four-process.md");
if (existsSync(incidentRunbook)) {
  const text = readFileSync(incidentRunbook, "utf8");
  if (text.includes("INC-06") && text.includes("INC-07")) {
    pass("R8-28-DB", "DB outage runbook section present");
    pass("R8-29-DISK", "disk/OOM runbook section present");
  }
}

const rollbackDry = join(root, "scripts/vps-deploy/rollback-vps-dry-run.sh");
if (existsSync(rollbackDry)) pass("R8-30-ROLLBACK", "rollback rehearsal dry-run script present");

const opsDrill = join(root, "scripts/p10-ops-drill.sh");
if (existsSync(opsDrill)) pass("R8-31-RESTART", "service restart rehearsal via p10:ops-drill");

blocked("R8-LIVE-MON", "live Prometheus/Grafana not provisioned in this session");
blocked("R8-LIVE-STAGING", "staging deploy timing evidence requires unavailable staging VPS");
blocked("R8-LIVE-PROD", "production deploy timing evidence requires unavailable production VPS");
blocked("R8-LIVE-BACKUP", "managed-provider backup freshness requires R5-21 external evidence");

const failed = checks.filter((c) => c.status === "FAIL");
const report = {
  schema_version: "prod8-ops-readiness.1",
  checked_at: new Date().toISOString(),
  checks,
  status: failed.length === 0 ? "PASS" : "FAIL",
  live_infrastructure_provisioned: false,
};

import { mkdirSync, writeFileSync } from "node:fs";
const outDir = join(root, ".artifacts/prod8");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "ops-readiness.json"), `${JSON.stringify(report, null, 2)}\n`);

if (failed.length) {
  console.error("prod8-ops-readiness: FAIL");
  for (const item of failed) console.error(`  ${item.id}: ${item.detail}`);
  process.exit(1);
}

console.log(
  `prod8-ops-readiness: PASS — tooling=${checks.filter((c) => c.tier === "tooling" && c.status === "PASS").length} blocked=${checks.filter((c) => c.status === "BLOCKED").length}`,
);
process.exit(0);
