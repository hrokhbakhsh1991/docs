import type { FinanceSummary } from "@/finance/finance-reports-logic";

export const RECONCILIATION_TRIAGE_TEST_IDS = {
  page: "operator-reconciliation-triage-page",
  findingsList: "operator-reconciliation-findings-list",
  findingCard: "operator-reconciliation-finding-card",
  emptyState: "operator-reconciliation-empty-state",
} as const;

export type ReconciliationFindingCategory =
  | "payments"
  | "receipts"
  | "installments"
  | "failures"
  | "ledger";

export type ReconciliationFindingSeverity = "warning" | "critical" | "info";

export type ReconciliationFinding = {
  readonly id: string;
  readonly category: ReconciliationFindingCategory;
  readonly severity: ReconciliationFindingSeverity;
  readonly count: number;
  readonly actionHref: string;
};

export function buildReconciliationFindings(
  summary: FinanceSummary,
  overdueInstallments: number,
  ledgerEventCount?: number
): readonly ReconciliationFinding[] {
  const findings: ReconciliationFinding[] = [];

  if (summary.pendingReceiptReviews > 0) {
    findings.push({
      id: "pending-receipt-reviews",
      category: "receipts",
      severity: "warning",
      count: summary.pendingReceiptReviews,
      actionHref: "/finance?tab=receipts",
    });
  }

  if (summary.pendingManualPayments > 0) {
    findings.push({
      id: "pending-manual-payments",
      category: "payments",
      severity: "warning",
      count: summary.pendingManualPayments,
      actionHref: "/finance?tab=payments",
    });
  }

  if (summary.failedPayments > 0) {
    findings.push({
      id: "failed-payments",
      category: "failures",
      severity: "critical",
      count: summary.failedPayments,
      actionHref: "/finance?tab=payments",
    });
  }

  if (
    ledgerEventCount !== undefined &&
    summary.paidPayments > 0 &&
    ledgerEventCount === 0
  ) {
    findings.push({
      id: "ledger-journal-gap",
      category: "ledger",
      severity: "critical",
      count: summary.paidPayments,
      actionHref: "/finance?tab=ledger",
    });
  }

  if (overdueInstallments > 0) {
    findings.push({
      id: "overdue-installments",
      category: "installments",
      severity: "critical",
      count: overdueInstallments,
      actionHref: "/finance?tab=installments",
    });
  }

  return findings;
}

export function hasOpenReconciliationFindings(findings: readonly ReconciliationFinding[]): boolean {
  return findings.length > 0;
}
