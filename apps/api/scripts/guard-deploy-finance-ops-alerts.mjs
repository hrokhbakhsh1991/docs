#!/usr/bin/env node
/**
 * Phase 3.7 — Finance ops PrometheusRule + metric/runbook presence.
 * @see docs/phase-20/p7/appendices/FINANCE_OPS_HARDENING.md
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

const alertsPath = "deploy/alerts/finance-ops.yaml";
const hardeningDoc = "docs/phase-20/p7/appendices/FINANCE_OPS_HARDENING.md";
const runbookDoc = "docs/phase-20/p7/appendices/FINANCE-OPS-RUNBOOK.md";
const opsMetrics = "apps/api/src/workspace-finance/finance-ops-metrics.ts";
const catalog = "packages/finance-core/src/application/finance-metrics-catalog.ts";

for (const rel of [alertsPath, hardeningDoc, runbookDoc, opsMetrics, catalog]) {
  if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

if (violations.length === 0) {
  const rules = readFromRepo(alertsPath);
  if (!rules.includes("kind: PrometheusRule")) {
    violations.push(`${alertsPath} must define PrometheusRule`);
  }
  for (const alert of [
    "FinanceLedgerCaptureFailure",
    "FinanceOutboxBacklog",
    "FinanceApproveFailureSpike",
    "FinanceStuckPayments",
    "FinanceReconciliationMismatch",
    "FinanceDbOrStorageFailure",
  ]) {
    if (!rules.includes(alert)) {
      violations.push(`${alertsPath} must include alert ${alert}`);
    }
  }

  const catalogSrc = readFromRepo(catalog);
  for (const name of [
    "finance_payment_created_total",
    "finance_receipt_submitted_total",
    "finance_approve_total",
    "finance_ledger_capture_total",
    "finance_reaction_failed_total",
    "finance_outbox_oldest_pending_age_seconds",
    "finance_reconciliation_mismatch",
    "finance_stuck_payments",
  ]) {
    if (!catalogSrc.includes(name)) {
      violations.push(`${catalog} must define ${name}`);
    }
  }

  const metricsRoute = readFromRepo("apps/api/src/routes/internal/metrics.ts");
  if (!metricsRoute.includes("refreshFinanceOpsGaugesFromDb")) {
    violations.push("internal metrics scrape must refresh finance ops gauges");
  }

  const tenantScoped = readFromRepo("apps/api/src/observability/metrics.ts");
  if (!tenantScoped.includes("finance_approve_total")) {
    violations.push("finance counters must be tenant-scoped in metrics.ts");
  }
}

if (violations.length > 0) {
  console.error("guard:deploy-finance-ops-alerts FAILED:");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard:deploy-finance-ops-alerts OK");
