#!/usr/bin/env node
/**
 * Phase 3.18 — Finance SLO pack presence (alerts, dashboard, docs, latency metrics).
 * @see docs/phase-20/p7/appendices/FINANCE_SLO_FRAMEWORK.md
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

const required = [
  "deploy/alerts/finance-slo.yaml",
  "deploy/dashboards/finance-slo.json",
  "docs/phase-20/p7/appendices/FINANCE_SLO_FRAMEWORK.md",
  "docs/phase-20/p7/appendices/FINANCE_SLO_ALERT_MATRIX.md",
  "docs/phase-20/p7/appendices/FINANCE_SLO_COVERAGE.md",
];

for (const rel of required) {
  if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

if (violations.length === 0) {
  const rules = readFromRepo("deploy/alerts/finance-slo.yaml");
  for (const alert of [
    "FinanceApproveAvailabilityBurnFast",
    "FinanceApproveAvailabilityBurnSlow",
    "FinancePaymentLatencyBudget",
    "FinanceApproveLatencyBudget",
    "FinanceLedgerLatencyBudget",
    "FinanceOutboxLagSloWarn",
    "FinanceReplayDurationHigh",
    "FinanceReplayFailureSpike",
    "FinanceReconFindingsOpen",
    "FinanceErrorBudgetExhaustedProxy",
  ]) {
    if (!rules.includes(alert)) {
      violations.push(`finance-slo.yaml must include ${alert}`);
    }
  }

  const catalog = readFromRepo(
    "packages/finance-core/src/application/finance-metrics-catalog.ts"
  );
  for (const name of [
    "finance_payment_latency_ms",
    "finance_approve_latency_ms",
    "finance_ledger_latency_ms",
    "finance_latency_budget_exceeded_total",
    "FINANCE_LATENCY_BUDGET_MS",
  ]) {
    if (!catalog.includes(name)) {
      violations.push(`finance-metrics-catalog must define ${name}`);
    }
  }

  const dash = readFromRepo("deploy/dashboards/finance-slo.json");
  for (const needle of [
    "finance_approve_total",
    "finance_payment_latency_ms",
    "finance_outbox_oldest_pending_age_seconds",
    "outbox_replay_duration_ms",
    "finance_reconciliation_mismatch",
  ]) {
    if (!dash.includes(needle)) {
      violations.push(`finance-slo.json dashboard must reference ${needle}`);
    }
  }

  const runbook = readFromRepo("docs/phase-20/p7/appendices/FINANCE-OPS-RUNBOOK.md");
  if (!runbook.includes("## SLO") && !runbook.includes("## 4. SLO")) {
    violations.push("FINANCE-OPS-RUNBOOK.md must map SLO alerts");
  }

  const host = readFromRepo(
    "apps/api/src/workspace-finance/infrastructure/host-finance-metrics.adapter.ts"
  );
  if (!host.includes("observe(")) {
    violations.push("HostFinanceMetricsAdapter must implement observe");
  }
}

if (violations.length > 0) {
  console.error("guard:deploy-finance-slo FAILED:");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard:deploy-finance-slo OK");
