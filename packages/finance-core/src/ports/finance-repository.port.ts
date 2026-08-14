/**
 * Persistence port — FinanceService depends only on this contract (Phase 1.21).
 * Persistence drivers (RLS / outbox / Prisma) live under `infrastructure/`.
 * No Prisma client imports, RLS helpers, or concrete repository class unions here.
 */

import type { FinanceLedgerCapturePlan, FinanceLedgerJournalLine } from "@app-tour/finance-http-contracts";
import type {
  FinanceRefundRow,
  RefundReasonCode,
  RefundSourceKind,
  RefundStatus,
} from "../domain/refund/types";
import type { BookingPaymentSyncStatus } from "./booking-payment.port";

export type {
  FinanceRefundRow,
  RefundReasonCode,
  RefundSourceKind,
  RefundStatus,
} from "../domain/refund/types";

export type FinanceSummaryRow = {
  readonly pendingManualPayments: number;
  readonly pendingReceiptReviews: number;
  readonly paidPayments: number;
  readonly failedPayments: number;
  /** PR23-A.2 — status=Cancelled only; never folded into failedPayments. */
  readonly cancelledPayments: number;
};

export type CancelPendingManualPaymentAtomicInput = {
  readonly tenantId: string;
  readonly paymentId: string;
  readonly actorUserId: string;
  readonly reasonCode: string;
  readonly reasonNote: string | null;
  readonly occurredAtIso: string;
  /** Optional SHA-256 hex of HTTP Idempotency-Key (audit payload only). */
  readonly idempotencyKeyHash?: string;
};

export type CancelPendingManualPaymentAtomicResult = {
  readonly payment: FinancePaymentRow;
  readonly replay: boolean;
  readonly domainEventId: string;
  readonly auditPayload: {
    readonly tenantId: string;
    readonly paymentId: string;
    readonly registrationId: string;
    readonly actorUserId: string;
    readonly occurredAt: string;
    readonly fromStatus: "Pending";
    readonly toStatus: "Cancelled";
    readonly method: "Manual";
    readonly reasonCode: string;
    readonly reasonNote: string | null;
    readonly amount: string;
    readonly currency: string;
    readonly openReceiptCount: 0;
    readonly idempotencyKeyHash?: string;
  };
};

/** FC-3 — tour-level payment rollup (read-only; host SQL). */
export type FinanceTourPaymentAggregateRow = {
  readonly tourId: string;
  readonly tourTitle: string;
  readonly paidCount: number;
  readonly paidMinor: string;
  readonly pendingCount: number;
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
  /**
   * Optional obligation / schedule hints for post-Paid balance → booking projection.
   * Computed inside the approve TX with Paid-inclusive invoice facts.
   */
  readonly obligationMinor?: string;
  readonly scheduleAmountsMinor?: readonly string[];
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
  /** PR23-E2 — sum of Completed refund amounts for the registration. */
  readonly refundedCompletedMinor: string;
};

export type CreateRefundInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly paymentId: string | null;
  readonly sourceKind: RefundSourceKind;
  readonly amountMinor: string;
  readonly currency: string;
  readonly reasonCode: RefundReasonCode;
  readonly reasonNote: string | null;
  readonly requestedByUserId: string;
  readonly requestedAtIso: string;
  readonly evidenceFileKey?: string | null;
  readonly evidenceNote?: string | null;
  readonly creationIdempotencyKey?: string | null;
};

export type SumCompletedRefundsQuery = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly paymentId?: string;
  readonly sourceKind?: RefundSourceKind;
  /** When summing for Complete hard-check, exclude this refund id (not yet Completed). */
  readonly excludeRefundId?: string;
};

export type TransitionRefundStatusInput = {
  readonly tenantId: string;
  readonly refundId: string;
  readonly fromStatuses: readonly RefundStatus[];
  readonly toStatus: RefundStatus;
  readonly actorUserId: string;
  readonly occurredAtIso: string;
  readonly rejectNote?: string | null;
  readonly completionNote?: string | null;
};

export type UpdateReceiptReviewInput = {
  readonly status: "Approved" | "Rejected";
  readonly reviewedByUserId: string;
  readonly reviewNote?: string;
  readonly ledgerJournalId?: string;
};

/** PR23-B2 — pending receipt list query (scope before limit). */
export type ListPendingReceiptsQuery = {
  readonly limit: number;
  readonly cursor?: string | null;
  readonly registrationId?: string;
  /**
   * When set (including empty), restrict to these registration IDs (tour scope).
   * Ignored when `registrationId` is set.
   */
  readonly registrationIds?: readonly string[];
};

export type ListPendingReceiptsPage = {
  readonly rows: readonly FinanceReceiptRow[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

/** PR23-C2 — E1 source: Pending payment + payment-scoped latest receipt Rejected. */
export type FinanceExceptionE1SourceRow = {
  readonly paymentId: string;
  readonly registrationId: string;
  readonly amount: string;
  readonly currency: string;
  readonly method: string;
  readonly receiptId: string;
  readonly reviewNote: string | null;
  readonly occurredAt: Date;
};

/** PR23-C2 — E2 source: Cancelled payment (balance filter applied in FinanceService). */
export type FinanceExceptionE2SourceRow = {
  readonly paymentId: string;
  readonly registrationId: string;
  readonly amount: string;
  readonly currency: string;
  readonly method: string;
  readonly reasonCode: string | null;
  readonly occurredAt: Date;
};

export type ListFinanceExceptionSourcesResult = {
  readonly rejectedReceiptPendingPayments: readonly FinanceExceptionE1SourceRow[];
  readonly cancelledPayments: readonly FinanceExceptionE2SourceRow[];
};

/** PR23-D1 — candidate registration for outstanding AR (invoice filter applied in service). */
export type OutstandingBalanceCandidateRow = {
  readonly registrationId: string;
  /** Obligation/open clock for ordering — registration createdAt (not payment rows). */
  readonly occurredAt: Date;
};

export type ListOutstandingBalanceCandidatesResult = {
  readonly candidates: readonly OutstandingBalanceCandidateRow[];
};

/** PR23-E3 — keyset page for operator refund list (order requestedAt DESC, id DESC). */
export type ListRefundsPageQuery = {
  readonly tenantId: string;
  readonly registrationId?: string;
  readonly status?: RefundStatus;
  readonly limit: number;
  /** Opaque keyset position; ISO `requestedAt` + `id` of last returned row. */
  readonly cursor?: { readonly requestedAt: string; readonly id: string } | null;
};

export type ListRefundsPageResult = {
  readonly rows: readonly FinanceRefundRow[];
  readonly hasMore: boolean;
};

/**
 * Domain persistence operations used by {@link FinanceService}.
 * Implementations must preserve approve / prepayment transaction semantics.
 */
export interface FinanceRepositoryPort {
  getSummary(tenantId: string): Promise<FinanceSummaryRow>;

  listOpenPayments(tenantId: string, limit: number): Promise<FinanceOpenPaymentRow[]>;

  listPayments(tenantId: string, limit: number): Promise<FinancePaymentRow[]>;

  /** FC-3 — aggregate payments by tour via operator_registrations join. */
  listPaymentsByTourAggregate(
    tenantId: string,
    tourId?: string
  ): Promise<readonly FinanceTourPaymentAggregateRow[]>;

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

  /**
   * PR23-B2 — pending receipt page with scope-before-limit + keyset cursor.
   * Order: createdAt ASC, id ASC.
   */
  listPendingReceipts(
    tenantId: string,
    query: ListPendingReceiptsQuery
  ): Promise<ListPendingReceiptsPage>;

  /**
   * PR23-C2 — source rows for operator exceptions (no invoice / booking enrichment).
   * E1 already applies payment-scoped latest-receipt = Rejected.
   */
  listFinanceExceptionSources(
    tenantId: string
  ): Promise<ListFinanceExceptionSourcesResult>;

  /**
   * PR23-D1 — registration candidates for outstanding AR (no invoice amounts).
   * Service compiles invoice and keeps remaining > 0 only.
   */
  listOutstandingBalanceCandidates(
    tenantId: string
  ): Promise<ListOutstandingBalanceCandidatesResult>;

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

  /**
   * PR23-A.2 — Pending → Cancelled (Manual only). No ledger / booking mutation.
   * Concurrent with approve: conditional Pending update yields Paid XOR Cancelled.
   */
  cancelPendingManualPaymentAtomic(
    input: CancelPendingManualPaymentAtomicInput
  ): Promise<CancelPendingManualPaymentAtomicResult>;

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

  /** PR23-E2 — create Requested refund (no money). */
  createRefund(input: CreateRefundInput): Promise<FinanceRefundRow>;

  findRefundById(tenantId: string, refundId: string): Promise<FinanceRefundRow | null>;

  findRefundByCreationIdempotencyKey(
    tenantId: string,
    creationIdempotencyKey: string
  ): Promise<FinanceRefundRow | null>;

  listRefundsForRegistration(
    tenantId: string,
    registrationId: string
  ): Promise<readonly FinanceRefundRow[]>;

  /**
   * PR23-E3 — operator refund page (scope + status filters before limit).
   * Order: requestedAt DESC, id DESC. Keyset: strictly older than cursor.
   */
  listRefundsPage(query: ListRefundsPageQuery): Promise<ListRefundsPageResult>;

  /** Sum Completed refund amounts (digit strings). Optional payment/source filters. */
  sumCompletedRefundsMinor(query: SumCompletedRefundsQuery): Promise<string>;

  /**
   * Conditional status transition. Idempotent when already `toStatus` for Completed/Approved.
   * Throws REFUND_NOT_FOUND | REFUND_NOT_TRANSITIONABLE.
   */
  transitionRefundStatus(input: TransitionRefundStatusInput): Promise<{
    readonly refund: FinanceRefundRow;
    readonly replay: boolean;
  }>;
}
