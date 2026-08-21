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

/** Path B — TourCreated paid settlement journal (optional workspace capability). */
export type BuildTourCreatedPaidJournalInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly paidAmountMinor: string;
  readonly currency: string;
  readonly tourCreatedDomainEventId: string;
};

/**
 * Workspace-supplied accounting policy (chart, wallet id, journal materialization).
 */
export interface FinanceLedgerPolicyPort {
  buildPaymentCaptureJournal(input: BuildPaymentCaptureJournalInput): FinanceLedgerCapturePlan;
  buildPrepaymentJournal(input: BuildPrepaymentJournalInput): FinanceLedgerCapturePlan;
  /**
   * Optional — TourCreated Path B paid ledger. Denali implements; fixture workspaces omit.
   */
  buildTourCreatedPaidJournal?(input: BuildTourCreatedPaidJournalInput): FinanceLedgerCapturePlan;
}

export type FinanceOfflineReceiptDefaults = {
  readonly amountMinor: string;
  readonly currency: string;
};

export interface FinanceReceiptDefaultsPort {
  offlineReceiptPaymentDefaults(): FinanceOfflineReceiptDefaults;
}

/** Workspace resolves what the registration owes (minor units) — FC-2. */
export type FinanceRegistrationObligation = {
  readonly currency: string;
  /** Final payable obligation Finance treats as money-path total. */
  readonly obligationMinor: string;
  /**
   * Raw commercial amount before reducers (override, free collection, future discount).
   * When omitted, Finance assumes gross equals payable.
   */
  readonly grossObligationMinor?: string;
  /** Amount eligible for membership/base-price reducers; add-ons remain outside this base. */
  readonly discountableBaseMinor?: string;
  readonly source: "tour_canonical" | "schedule" | "operator_override" | "unknown";
};

/** How payment is collected after booking approval (Denali phase 4). */
export type FinancePaymentCollectionMode = "offline" | "free";

/** Ops write — personal registration obligation override (phase 5). */
export type FinanceRegistrationObligationOverrideInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly obligationMinor: string;
  readonly setAt: string;
  readonly setByUserId: string;
  readonly reason?: string;
};

export interface FinanceObligationPort {
  resolveRegistrationObligation(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<FinanceRegistrationObligation | null>;

  /**
   * Payment collection mode for the registration's tour.
   * Missing binding / unknown tour → `offline` (fail closed to receipt path).
   */
  resolveRegistrationPaymentCollection(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<FinancePaymentCollectionMode>;

  /**
   * Persist per-registration commercial override (Finance-owned).
   * Host may store bytes on booking intake; returns false when registration missing / tenant mismatch.
   */
  setRegistrationObligationOverride(
    input: FinanceRegistrationObligationOverrideInput
  ): Promise<boolean>;
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
