/**
 * Persistence port — FinanceService depends only on this contract (Phase 1.21).
 * Persistence drivers (RLS / outbox / Prisma) live under `infrastructure/`.
 * No Prisma client imports, RLS helpers, or concrete repository class unions here.
 */

import type { FinanceLedgerCapturePlan, FinanceLedgerJournalLine } from "@app-tour/finance-http-contracts";
import type { BookingPaymentSyncStatus } from "./booking-payment.port";

export type FinanceSummaryRow = {
  readonly pendingManualPayments: number;
  readonly pendingReceiptReviews: number;
  readonly paidPayments: number;
  readonly failedPayments: number;
};

export type FinanceOpenPaymentRow = {
  readonly id: string;
  readonly registrationId: string;
  readonly amount: string;
  readonly currency: string;
  readonly method: string;
  readonly status: string;
  readonly createdAt: Date;
};

export type FinancePaymentRow = FinanceOpenPaymentRow & {
  readonly provider: string;
  readonly paidAt: Date | null;
};

export type FinanceReceiptRow = {
  readonly id: string;
  readonly paymentId: string;
  readonly fileKey: string;
  readonly status: string;
  readonly note: string | null;
  readonly reviewNote: string | null;
  readonly reviewedAt: Date | null;
  readonly ledgerJournalId: string | null;
  readonly createdAt: Date;
  readonly payment: FinancePaymentRow | null;
};

export type FinanceLedgerOutboxRow = {
  readonly id: string;
  readonly eventType: string;
  readonly payload: unknown;
  readonly createdAt: Date;
  readonly domainEventId: string | null;
  readonly aggregateId: string;
};

export type CreatePaymentInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly amount: string;
  readonly currency: string;
  readonly method: string;
  readonly provider: string;
  readonly status: string;
  /** SHA-256 hex of HTTP Idempotency-Key; omit for non-HTTP creates. */
  readonly creationIdempotencyKey?: string;
};

export type CreateReceiptInput = {
  readonly tenantId: string;
  readonly paymentId: string;
  readonly fileKey: string;
  readonly note?: string;
  /** SHA-256 hex of HTTP Idempotency-Key; omit for non-HTTP submits. */
  readonly idempotencyKeyHash?: string;
};

export type ApproveManualReceiptAtomicInput = {
  readonly tenantId: string;
  readonly paymentId: string;
  readonly receiptId: string;
  readonly registrationId: string;
  readonly journalId: string;
  readonly reviewedByUserId: string;
  readonly reviewNote?: string;
  /** When set, ledger outbox is enqueued last inside the same RLS transaction. */
  readonly ledgerCapture?: FinanceLedgerCapturePlan;
};

export type ApproveManualReceiptAtomicResult = {
  readonly id: string;
  readonly status: string;
  readonly reviewNote: string | null;
  readonly reviewedAt: string | null;
  readonly ledgerJournalId: string;
  readonly bookingPaymentStatus: BookingPaymentSyncStatus;
};

export type FinancePrepaymentListRow = {
  readonly id: string;
  readonly registrationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly method: string;
  readonly note: string | null;
  readonly recordedAt: string;
};

export type RecordPrepaymentAtomicInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly method: string;
  readonly note: string | null;
  readonly journalId: string;
  readonly recordedAt: string;
  readonly lines: readonly FinanceLedgerJournalLine[];
  readonly ledgerDomainEventId: string;
  readonly prepaymentDomainEventId: string;
  readonly clientOperationKeyHash: string;
};

export type RecordPrepaymentAtomicResult = {
  readonly created: boolean;
  readonly id: string;
  readonly registrationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly method: string;
  readonly note: string | null;
  readonly recordedAt: string;
};

export type PrepaymentBookingSyncDegradedRow = {
  readonly registrationId: string;
  readonly paymentStatus: string;
  readonly error: string;
  readonly prepaymentDomainEventId: string | null;
  readonly degradedAt: string;
};

export type RegistrationInvoiceFacts = {
  readonly prepaymentMinor: string;
  readonly paidPaymentsMinor: string;
  readonly paymentAmountsMinor: readonly string[];
  readonly currency: string;
};

export type UpdateReceiptReviewInput = {
  readonly status: "Approved" | "Rejected";
  readonly reviewedByUserId: string;
  readonly reviewNote?: string;
  readonly ledgerJournalId?: string;
};

/**
 * Domain persistence operations used by {@link FinanceService}.
 * Implementations must preserve approve / prepayment transaction semantics.
 */
export interface FinanceRepositoryPort {
  getSummary(tenantId: string): Promise<FinanceSummaryRow>;

  listOpenPayments(tenantId: string, limit: number): Promise<FinanceOpenPaymentRow[]>;

  listPayments(tenantId: string, limit: number): Promise<FinancePaymentRow[]>;

  listLedgerEvents(tenantId: string, limit: number): Promise<FinanceLedgerOutboxRow[]>;

  findPaymentStatusesByRegistration(
    tenantId: string,
    registrationId: string
  ): Promise<readonly string[]>;

  createManualPayment(input: CreatePaymentInput): Promise<FinancePaymentRow>;

  findPaymentById(tenantId: string, paymentId: string): Promise<FinancePaymentRow | null>;

  findPaymentByCreationIdempotencyKey(
    tenantId: string,
    creationIdempotencyKey: string
  ): Promise<FinancePaymentRow | null>;

  findFirstPendingManualPayment(
    tenantId: string,
    registrationId: string
  ): Promise<FinancePaymentRow | null>;

  findLatestReceiptForRegistration(
    tenantId: string,
    registrationId: string
  ): Promise<FinanceReceiptRow | null>;

  createReceipt(input: CreateReceiptInput): Promise<FinanceReceiptRow>;

  findReceiptById(tenantId: string, receiptId: string): Promise<FinanceReceiptRow | null>;

  listPendingReceipts(tenantId: string, limit: number): Promise<FinanceReceiptRow[]>;

  updateReceiptReview(
    tenantId: string,
    receiptId: string,
    input: UpdateReceiptReviewInput
  ): Promise<FinanceReceiptRow>;

  /**
   * Approve path — single tenant RLS transaction (or fail-closed memory simulation):
   * payment Paid → booking paymentStatus paid → receipt Approved → outbox (last).
   */
  approveManualReceiptAtomic(
    input: ApproveManualReceiptAtomicInput
  ): Promise<ApproveManualReceiptAtomicResult>;

  listPrepayments(tenantId: string, limit: number): Promise<readonly FinancePrepaymentListRow[]>;

  recordPrepaymentAtomic(
    input: RecordPrepaymentAtomicInput
  ): Promise<RecordPrepaymentAtomicResult>;

  recordPrepaymentBookingSyncDegraded(input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly paymentStatus: string;
    readonly error: string;
    readonly prepaymentDomainEventId: string;
  }): Promise<void>;

  listOpenPrepaymentBookingSyncDegraded(
    tenantId: string,
    limit: number
  ): Promise<readonly PrepaymentBookingSyncDegradedRow[]>;

  markPrepaymentBookingSyncRecovered(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<void>;

  getRegistrationInvoiceFacts(
    tenantId: string,
    registrationId: string
  ): Promise<RegistrationInvoiceFacts>;
}
