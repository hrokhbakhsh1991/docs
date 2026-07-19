/**
 * Phase 3.7 / 3.18 — stable finance metric names (engine + host must agree).
 * Label cardinality: tenant_id + workspace_type (+ result / operation where noted).
 */

export const FINANCE_METRIC = {
  paymentCreated: "finance_payment_created_total",
  receiptSubmitted: "finance_receipt_submitted_total",
  approve: "finance_approve_total",
  ledgerCapture: "finance_ledger_capture_total",
  reactionFailed: "finance_reaction_failed_total",
  prepaymentDegradedPersistFailed:
    "finance_prepayment_booking_sync_degraded_persist_failed_total",
  /** Last observed latency gauges (ms). */
  paymentLatencyMs: "finance_payment_latency_ms",
  approveLatencyMs: "finance_approve_latency_ms",
  ledgerLatencyMs: "finance_ledger_latency_ms",
  /** Incremented when operation exceeds SLO hard budget. */
  latencyBudgetExceeded: "finance_latency_budget_exceeded_total",
  /** Host gauges (scrape-refreshed). */
  outboxOldestPendingAgeSeconds: "finance_outbox_oldest_pending_age_seconds",
  reconciliationMismatch: "finance_reconciliation_mismatch",
  stuckPayments: "finance_stuck_payments",
} as const;

/** Hard latency budgets (ms) — FINANCE_SLO_FRAMEWORK. */
export const FINANCE_LATENCY_BUDGET_MS = {
  payment: 2_000,
  approve: 5_000,
  ledger: 1_000,
} as const;

export type FinanceLatencyOperation = keyof typeof FINANCE_LATENCY_BUDGET_MS;

export type FinanceMetricName = (typeof FINANCE_METRIC)[keyof typeof FINANCE_METRIC];

export type FinanceApproveMetricResult = "success" | "failure" | "replay";

export type FinanceLedgerCaptureMetricResult =
  | "success"
  | "failure"
  | "skipped_empty"
  | "omitted_non_durable";
