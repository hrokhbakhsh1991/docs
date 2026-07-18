/**
 * Workspace finance capability ports (Phase 1.9).
 * Shared so workspace packages implement adapters without importing apps/api.
 * Not finance-core extraction — contracts only.
 */

export type FinanceLedgerPostingSide = "debit" | "credit";

export type FinanceLedgerJournalLine = {
  readonly id: string;
  readonly journalId: string;
  readonly tenantId: string;
  readonly account: string;
  readonly side: FinanceLedgerPostingSide;
  readonly amount_minor: string;
  readonly currency: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly reversesLineId?: string;
  readonly createdAt: string;
  readonly metadata?: Record<string, unknown>;
};

/** Plan returned by workspace ledger policy — host TX enqueues outbox. */
export type FinanceLedgerCapturePlan = {
  readonly journalId: string;
  readonly domainEventId: string;
  readonly lines: readonly FinanceLedgerJournalLine[];
};

export type BuildPaymentCaptureJournalInput = {
  readonly tenantId: string;
  readonly paymentId: string;
  readonly registrationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly capturedAtIso: string;
};

export type BuildPrepaymentJournalInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly method: string;
  readonly recordedAtIso: string;
  readonly keyHash: string;
  readonly prepaymentDomainEventId: string;
  readonly ledgerDomainEventId: string;
  readonly journalSeed: string;
};

/**
 * Workspace-supplied accounting policy (chart, wallet id, journal materialization).
 */
export interface FinanceLedgerPolicyPort {
  buildPaymentCaptureJournal(input: BuildPaymentCaptureJournalInput): FinanceLedgerCapturePlan;
  buildPrepaymentJournal(input: BuildPrepaymentJournalInput): FinanceLedgerCapturePlan;
}

export type FinanceOfflineReceiptDefaults = {
  readonly amountMinor: string;
  readonly currency: string;
};

export interface FinanceReceiptDefaultsPort {
  offlineReceiptPaymentDefaults(): FinanceOfflineReceiptDefaults;
}

export type WorkspaceFinanceReactionBatchResult = {
  readonly handled: number;
  readonly skipped: number;
};

export type WorkspaceFinancePublishedOutboxRow = {
  readonly tenantId: string;
  readonly domainEventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: unknown;
};

/**
 * Workspace-owned TourCreated → finance ledger reaction.
 */
export interface WorkspaceFinanceEventReactionPort {
  consumePendingForTenant(tenantId: string): Promise<WorkspaceFinanceReactionBatchResult>;
  reactToPublishedRow(row: WorkspaceFinancePublishedOutboxRow): Promise<boolean>;
}
