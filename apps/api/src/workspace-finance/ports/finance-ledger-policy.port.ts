/**
 * Host-owned ledger journal line — structural twin of Denali LedgerJournalLine.
 * Keeps FinanceService/Repository free of workspace ledger policy imports.
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
 * Wired at boot — FinanceService must not select rules by workspace type.
 */
export interface FinanceLedgerPolicyPort {
  buildPaymentCaptureJournal(input: BuildPaymentCaptureJournalInput): FinanceLedgerCapturePlan;
  buildPrepaymentJournal(input: BuildPrepaymentJournalInput): FinanceLedgerCapturePlan;
}
