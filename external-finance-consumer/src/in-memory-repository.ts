/**
 * External-consumer in-memory FinanceRepositoryPort.
 * Imports only @app-tour/finance-core — simulates second-repo adapter.
 * Not production-equivalent to Prisma RLS / outbox atomics.
 */
import { randomUUID } from "node:crypto";

import type {
  ApproveManualReceiptAtomicInput,
  ApproveManualReceiptAtomicResult,
  CancelPendingManualPaymentAtomicInput,
  CancelPendingManualPaymentAtomicResult,
  CreatePaymentInput,
  CreateReceiptInput,
  CreateRefundInput,
  FinanceLedgerOutboxRow,
  FinanceOpenPaymentRow,
  FinancePaymentRow,
  FinancePrepaymentListRow,
  FinanceReceiptRow,
  FinanceRefundRow,
  FinanceRepositoryPort,
  FinanceSummaryRow,
  IBookingPaymentPort,
  ListPendingReceiptsPage,
  ListPendingReceiptsQuery,
  ListRefundsPageQuery,
  ListRefundsPageResult,
  PrepaymentBookingSyncDegradedRow,
  RecordPrepaymentAtomicInput,
  RegistrationInvoiceFacts,
  SumCompletedRefundsQuery,
  TransitionRefundStatusInput,
  UpdateReceiptReviewInput,
} from "@app-tour/finance-core";
import {
  compareOperatorRefundOrder,
  isOlderThanOperatorRefundCursor,
  paginatePendingReceiptRows,
  resolveApproveBookingPaymentStatus,
} from "@app-tour/finance-core/domain";

type StoredPayment = FinancePaymentRow & {
  readonly tenantId: string;
  readonly creationIdempotencyKey?: string;
};
type StoredReceipt = FinanceReceiptRow & {
  readonly tenantId: string;
  readonly idempotencyKeyHash?: string;
};

let paymentsById = new Map<string, StoredPayment>();
let receiptsById = new Map<string, StoredReceipt>();
let ledgerEvents: FinanceLedgerOutboxRow[] = [];
let prepaymentsByDomainEventId = new Map<string, FinancePrepaymentListRow & { readonly tenantId: string }>();
let refundsById = new Map<string, FinanceRefundRow>();


export function resetExternalFinanceRepository(): void {
  paymentsById = new Map();
  receiptsById = new Map();
  ledgerEvents = [];
  prepaymentsByDomainEventId = new Map();
  refundsById = new Map();
}

/**
 * Unit-test fake only — not production-equivalent to Prisma `approveManualReceiptAtomic`.
 * Atomicity / concurrency / HTTP idempotency proofs require STORAGE_DRIVER=prisma.
 */
export class ExternalFinanceRepository implements FinanceRepositoryPort {
  constructor(private readonly bookingPayments: IBookingPaymentPort) {}
  async getSummary(tenantId: string): Promise<FinanceSummaryRow> {
    const tenantPayments = [...paymentsById.values()].filter((row) => row.tenantId === tenantId);
    const tenantReceipts = [...receiptsById.values()].filter((row) => row.tenantId === tenantId);
    return {
      pendingManualPayments: tenantPayments.filter(
        (row) => row.method === "Manual" && row.status === "Pending"
      ).length,
      pendingReceiptReviews: tenantReceipts.filter((row) => row.status === "Pending").length,
      paidPayments: tenantPayments.filter((row) => row.status === "Paid").length,
      failedPayments: tenantPayments.filter((row) => row.status === "Failed").length,
      cancelledPayments: tenantPayments.filter((row) => row.status === "Cancelled").length,
    };
  }

  async listOpenPayments(tenantId: string, limit: number): Promise<FinanceOpenPaymentRow[]> {
    return [...paymentsById.values()]
      .filter((row) => row.tenantId === tenantId)
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        registrationId: row.registrationId,
        amount: row.amount,
        currency: row.currency,
        method: row.method,
        status: row.status,
        createdAt: row.createdAt,
      }));
  }

  async listPayments(tenantId: string, limit: number): Promise<FinancePaymentRow[]> {
    return [...paymentsById.values()].filter((row) => row.tenantId === tenantId).slice(0, limit);
  }

  async listLedgerEvents(tenantId: string, limit: number): Promise<FinanceLedgerOutboxRow[]> {
    void tenantId;
    return ledgerEvents.slice(0, limit);
  }

  async findPaymentStatusesByRegistration(
    tenantId: string,
    registrationId: string
  ): Promise<readonly string[]> {
    return [...paymentsById.values()]
      .filter((row) => row.tenantId === tenantId && row.registrationId === registrationId)
      .map((row) => row.status);
  }

  async findFirstPendingManualPayment(
    tenantId: string,
    registrationId: string
  ): Promise<FinancePaymentRow | null> {
    for (const row of paymentsById.values()) {
      if (
        row.tenantId === tenantId &&
        row.registrationId === registrationId &&
        row.method === "Manual" &&
        row.status === "Pending"
      ) {
        return row;
      }
    }
    return null;
  }

  async createManualPayment(input: CreatePaymentInput): Promise<FinancePaymentRow> {
    if (input.creationIdempotencyKey !== undefined) {
      for (const existing of paymentsById.values()) {
        if (
          existing.tenantId === input.tenantId &&
          existing.creationIdempotencyKey === input.creationIdempotencyKey
        ) {
          if (
            existing.registrationId !== input.registrationId ||
            existing.amount !== input.amount ||
            existing.currency !== input.currency.toUpperCase()
          ) {
            throw new Error("FINANCE_PAYMENT_IDEMPOTENCY_CONFLICT");
          }
          return existing;
        }
      }
    }
    const now = new Date();
    const row: StoredPayment = {
      id: randomUUID(),
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      method: input.method,
      provider: input.provider,
      status: input.status,
      paidAt: null,
      createdAt: now,
      ...(input.creationIdempotencyKey !== undefined
        ? { creationIdempotencyKey: input.creationIdempotencyKey }
        : {}),
    };
    paymentsById.set(row.id, row);
    return row;
  }

  async findPaymentById(tenantId: string, paymentId: string): Promise<FinancePaymentRow | null> {
    const row = paymentsById.get(paymentId);
    if (row === undefined || row.tenantId !== tenantId) {
      return null;
    }
    return row;
  }

  async findPaymentByCreationIdempotencyKey(
    tenantId: string,
    creationIdempotencyKey: string
  ): Promise<FinancePaymentRow | null> {
    for (const row of paymentsById.values()) {
      if (
        row.tenantId === tenantId &&
        row.creationIdempotencyKey === creationIdempotencyKey
      ) {
        return row;
      }
    }
    return null;
  }

  async countPendingReceiptsForPayment(tenantId: string, paymentId: string): Promise<number> {
    let count = 0;
    for (const receipt of receiptsById.values()) {
      if (receipt.tenantId === tenantId && receipt.paymentId === paymentId && receipt.status === "Pending") {
        count += 1;
      }
    }
    return count;
  }

  async findLatestReceiptForRegistration(
    tenantId: string,
    registrationId: string
  ): Promise<FinanceReceiptRow | null> {
    const matching = [...receiptsById.values()].filter(
      (row) =>
        row.tenantId === tenantId &&
        row.payment !== null &&
        row.payment.registrationId === registrationId
    );
    if (matching.length === 0) {
      return null;
    }
    matching.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return matching[0] ?? null;
  }

  async createReceipt(input: CreateReceiptInput): Promise<FinanceReceiptRow> {
    if (input.idempotencyKeyHash !== undefined) {
      for (const existing of receiptsById.values()) {
        if (
          existing.tenantId === input.tenantId &&
          existing.idempotencyKeyHash === input.idempotencyKeyHash
        ) {
          if (
            existing.paymentId !== input.paymentId ||
            existing.fileKey !== input.fileKey ||
            (input.note !== undefined && existing.note !== (input.note ?? null))
          ) {
            throw new Error("FINANCE_RECEIPT_IDEMPOTENCY_CONFLICT");
          }
          return existing;
        }
      }
    }
    const payment = await this.findPaymentById(input.tenantId, input.paymentId);
    if (payment === null) {
      throw new Error("FINANCE_PAYMENT_NOT_FOUND");
    }
    const pendingCount = await this.countPendingReceiptsForPayment(
      input.tenantId,
      input.paymentId
    );
    if (pendingCount > 0) {
      throw new Error("ZOD_VALIDATION_FAILED: payment already has a pending receipt");
    }
    const now = new Date();
    const receipt: StoredReceipt = {
      id: randomUUID(),
      tenantId: input.tenantId,
      paymentId: input.paymentId,
      fileKey: input.fileKey,
      status: "Pending",
      note: input.note ?? null,
      reviewNote: null,
      reviewedAt: null,
      ledgerJournalId: null,
      createdAt: now,
      payment,
      ...(input.idempotencyKeyHash !== undefined
        ? { idempotencyKeyHash: input.idempotencyKeyHash }
        : {}),
    };
    receiptsById.set(receipt.id, receipt);
    return receipt;
  }

  async findReceiptById(tenantId: string, receiptId: string): Promise<FinanceReceiptRow | null> {
    const row = receiptsById.get(receiptId);
    if (row === undefined || row.tenantId !== tenantId) {
      return null;
    }
    return row;
  }

  async listPendingReceipts(
    tenantId: string,
    query: ListPendingReceiptsQuery
  ): Promise<ListPendingReceiptsPage> {
    const pending = [...receiptsById.values()].filter(
      (row) => row.tenantId === tenantId && row.status === "Pending"
    );
    return paginatePendingReceiptRows({
      rows: pending,
      tenantId,
      limit: query.limit,
      cursor: query.cursor,
      registrationId: query.registrationId,
      registrationIds: query.registrationIds,
    });
  }

  async listFinanceExceptionSources(tenantId: string) {
    void tenantId;
    return { rejectedReceiptPendingPayments: [], cancelledPayments: [] };
  }

  async listOutstandingBalanceCandidates(tenantId: string) {
    void tenantId;
    return { candidates: [] };
  }

  async updateReceiptReview(
    tenantId: string,
    receiptId: string,
    input: UpdateReceiptReviewInput
  ): Promise<FinanceReceiptRow> {
    const row = receiptsById.get(receiptId);
    if (row === undefined || row.tenantId !== tenantId) {
      throw new Error("FINANCE_RECEIPT_NOT_FOUND");
    }
    const now = new Date();
    const payment = row.payment;
    const updated: StoredReceipt = {
      ...row,
      status: input.status,
      reviewNote: input.reviewNote ?? row.reviewNote,
      reviewedAt: now,
      ledgerJournalId: input.ledgerJournalId ?? row.ledgerJournalId,
      payment:
        payment !== null
          ? {
              ...payment,
              status: input.status === "Approved" ? "Paid" : payment.status,
              paidAt: input.status === "Approved" ? now : payment.paidAt,
            }
          : null,
    };
    receiptsById.set(receiptId, updated);
    if (payment !== null && input.status === "Approved") {
      const paidPayment = paymentsById.get(payment.id);
      if (paidPayment !== undefined) {
        paymentsById.set(payment.id, {
          ...paidPayment,
          status: "Paid",
          paidAt: now,
        });
      }
    }
    return updated;
  }

  async markPaymentPaid(
    tenantId: string,
    paymentId: string,
    ledgerJournalId: string
  ): Promise<FinancePaymentRow> {
    const row = paymentsById.get(paymentId);
    if (row === undefined || row.tenantId !== tenantId) {
      throw new Error("FINANCE_PAYMENT_NOT_FOUND");
    }
    const now = new Date();
    const updated: StoredPayment = {
      ...row,
      status: "Paid",
      paidAt: now,
    };
    paymentsById.set(paymentId, updated);
    for (const [receiptId, receipt] of receiptsById.entries()) {
      if (receipt.paymentId === paymentId) {
        receiptsById.set(receiptId, { ...receipt, payment: updated });
      }
    }
    ledgerEvents.push({
      id: randomUUID(),
      eventType: "finance.ledger.double_entry_applied",
      payload: {
        journalId: ledgerJournalId,
        registrationId: row.registrationId,
        paymentId,
      },
      createdAt: now,
      domainEventId: `payment:${paymentId}:ledger-capture-anchor`,
      aggregateId: ledgerJournalId,
    });
    return updated;
  }

  async revertPaymentToPending(tenantId: string, paymentId: string): Promise<FinancePaymentRow> {
    const row = paymentsById.get(paymentId);
    if (row === undefined || row.tenantId !== tenantId) {
      throw new Error("FINANCE_PAYMENT_NOT_FOUND");
    }
    const updated: StoredPayment = {
      ...row,
      status: "Pending",
      paidAt: null,
    };
    paymentsById.set(paymentId, updated);
    for (const [receiptId, receipt] of receiptsById.entries()) {
      if (receipt.paymentId === paymentId) {
        receiptsById.set(receiptId, { ...receipt, payment: updated });
      }
    }
    // Fake-only: drop the provisional capture row so compensate does not leave orphan ledger facts.
    const captureDomainEventId = `payment:${paymentId}:ledger-capture-anchor`;
    ledgerEvents = ledgerEvents.filter((event) => event.domainEventId !== captureDomainEventId);
    return updated;
  }

  /**
   * Memory fail-closed simulation of Prisma approve (not a real transaction).
   * Booking projection via constructor-injected {@link IBookingPaymentPort}.
   */
  async approveManualReceiptAtomic(
    input: ApproveManualReceiptAtomicInput
  ): Promise<ApproveManualReceiptAtomicResult> {
    if (input.ledgerCapture !== undefined && input.ledgerCapture.lines.length === 0) {
      throw new Error("FINANCE_LEDGER_CAPTURE_EMPTY");
    }

    await this.markPaymentPaid(input.tenantId, input.paymentId, input.journalId);

    let bookingPaymentStatus: ApproveManualReceiptAtomicResult["bookingPaymentStatus"];
    try {
      const facts = await this.getRegistrationInvoiceFacts(input.tenantId, input.registrationId);
      const paymentStatus = resolveApproveBookingPaymentStatus({
        registrationId: input.registrationId,
        currency: facts.currency,
        prepaymentMinor: facts.prepaymentMinor,
        paidPaymentsMinor: facts.paidPaymentsMinor,
        paymentAmountsMinor: facts.paymentAmountsMinor,
        scheduleAmountsMinor: input.scheduleAmountsMinor,
        refundedCompletedMinor: facts.refundedCompletedMinor,
        ...(input.obligationMinor !== undefined
          ? { obligationMinor: input.obligationMinor }
          : {}),
      });
      bookingPaymentStatus = await this.bookingPayments.raisePaidInTx(
        {},
        {
          tenantId: input.tenantId,
          registrationId: input.registrationId,
          paymentStatus,
        }
      );
    } catch (error: unknown) {
      await this.revertPaymentToPending(input.tenantId, input.paymentId);
      if (error instanceof Error && error.message === "FINANCE_BOOKING_PAYMENT_SYNC_MISS") {
        throw error;
      }
      throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_FAILED");
    }

    const updated = await this.updateReceiptReview(input.tenantId, input.receiptId, {
      status: "Approved",
      reviewedByUserId: input.reviewedByUserId,
      reviewNote: input.reviewNote,
      ledgerJournalId: input.journalId,
    });

    if (input.ledgerCapture !== undefined && input.ledgerCapture.lines.length > 0) {
      const now = new Date();
      ledgerEvents.push({
        id: randomUUID(),
        eventType: "finance.ledger.capture",
        payload: {
          journalId: input.ledgerCapture.journalId,
          domainEventId: input.ledgerCapture.domainEventId,
          lines: input.ledgerCapture.lines,
          registrationId: input.registrationId,
          paymentId: input.paymentId,
        },
        createdAt: now,
        domainEventId: input.ledgerCapture.domainEventId,
        aggregateId: input.ledgerCapture.journalId,
      });
    }

    return {
      id: updated.id,
      status: updated.status,
      reviewNote: updated.reviewNote,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      ledgerJournalId: input.journalId,
      bookingPaymentStatus,
    };
  }


  async cancelPendingManualPaymentAtomic(
    input: CancelPendingManualPaymentAtomicInput
  ): Promise<CancelPendingManualPaymentAtomicResult> {
    const domainEventId = `payment-cancelled:${input.paymentId}`.slice(0, 128);
    const existing = paymentsById.get(input.paymentId);
    if (existing === undefined) {
      throw new Error("PAYMENT_NOT_FOUND");
    }
    if (existing.tenantId !== input.tenantId) {
      throw new Error("PAYMENT_NOT_IN_SCOPE");
    }
    if (existing.method !== "Manual") {
      throw new Error("PAYMENT_CANCEL_ONLY_MANUAL");
    }
    const buildAudit = (
      payment: FinancePaymentRow
    ): CancelPendingManualPaymentAtomicResult["auditPayload"] => ({
      tenantId: input.tenantId,
      paymentId: payment.id,
      registrationId: payment.registrationId,
      actorUserId: input.actorUserId,
      occurredAt: input.occurredAtIso,
      fromStatus: "Pending",
      toStatus: "Cancelled",
      method: "Manual",
      reasonCode: input.reasonCode,
      reasonNote: input.reasonNote,
      amount: payment.amount,
      currency: payment.currency,
      openReceiptCount: 0,
      ...(input.idempotencyKeyHash !== undefined
        ? { idempotencyKeyHash: input.idempotencyKeyHash }
        : {}),
    });
    if (existing.status === "Cancelled") {
      return {
        payment: existing,
        replay: true,
        domainEventId,
        auditPayload: buildAudit(existing),
      };
    }
    if (existing.status !== "Pending") {
      throw new Error("PAYMENT_NOT_CANCELLABLE");
    }
    let pendingReceipts = 0;
    for (const receipt of receiptsById.values()) {
      if (
        receipt.tenantId === input.tenantId &&
        receipt.paymentId === input.paymentId &&
        receipt.status === "Pending"
      ) {
        pendingReceipts += 1;
      }
    }
    if (pendingReceipts > 0) {
      throw new Error("PAYMENT_HAS_PENDING_RECEIPT");
    }
    const updated = { ...existing, status: "Cancelled" as const };
    paymentsById.set(input.paymentId, updated);
    const auditPayload = buildAudit(updated);
    ledgerEvents.push({
      id: randomUUID(),
      eventType: "finance.payment.cancelled",
      payload: auditPayload,
      createdAt: new Date(input.occurredAtIso),
      domainEventId,
      aggregateId: input.paymentId,
    });
    return {
      payment: updated,
      replay: false,
      domainEventId,
      auditPayload,
    };
  }

  async listPrepayments(
    tenantId: string,
    limit: number
  ): Promise<readonly FinancePrepaymentListRow[]> {
    return [...prepaymentsByDomainEventId.values()]
      .filter((row) => row.tenantId === tenantId)
      .slice(0, limit)
      .map(({ tenantId: _t, ...row }) => row);
  }

  async recordPrepaymentAtomic(
    input: RecordPrepaymentAtomicInput
  ): Promise<{
    readonly created: boolean;
    readonly id: string;
    readonly registrationId: string;
    readonly amountMinor: string;
    readonly currency: string;
    readonly method: string;
    readonly note: string | null;
    readonly recordedAt: string;
  }> {
    if (input.lines.length === 0) {
      throw new Error("FINANCE_LEDGER_CAPTURE_EMPTY");
    }
    const existing = prepaymentsByDomainEventId.get(input.prepaymentDomainEventId);
    if (existing !== undefined && existing.tenantId === input.tenantId) {
      return {
        created: false,
        id: existing.id,
        registrationId: existing.registrationId,
        amountMinor: existing.amountMinor,
        currency: existing.currency,
        method: existing.method,
        note: existing.note,
        recordedAt: existing.recordedAt,
      };
    }
    const id = randomUUID();
    const row = {
      tenantId: input.tenantId,
      id,
      registrationId: input.registrationId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      method: input.method,
      note: input.note,
      recordedAt: input.recordedAt,
    };
    prepaymentsByDomainEventId.set(input.prepaymentDomainEventId, row);
    const now = new Date();
    ledgerEvents.push({
      id: randomUUID(),
      eventType: "finance.ledger.capture",
      payload: {
        journalId: input.journalId,
        domainEventId: input.ledgerDomainEventId,
        lines: input.lines,
        registrationId: input.registrationId,
      },
      createdAt: now,
      domainEventId: input.ledgerDomainEventId,
      aggregateId: input.journalId,
    });
    ledgerEvents.push({
      id: randomUUID(),
      eventType: "finance.prepayment.recorded",
      payload: {
        registrationId: input.registrationId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        method: input.method,
        note: input.note,
        recordedAt: input.recordedAt,
      },
      createdAt: now,
      domainEventId: input.prepaymentDomainEventId,
      aggregateId: input.registrationId,
    });
    return {
      created: true,
      id,
      registrationId: input.registrationId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      method: input.method,
      note: input.note,
      recordedAt: input.recordedAt,
    };
  }

  async recordPrepaymentBookingSyncDegraded(_input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly paymentStatus: string;
    readonly error: string;
    readonly prepaymentDomainEventId: string;
  }): Promise<void> {
    /* memory fake — no durable degraded signal */
  }

  async listOpenPrepaymentBookingSyncDegraded(
    _tenantId: string,
    _limit: number
  ): Promise<readonly PrepaymentBookingSyncDegradedRow[]> {
    return [];
  }

  async markPrepaymentBookingSyncRecovered(_input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<void> {
    /* memory fake */
  }

  async getRegistrationInvoiceFacts(
    tenantId: string,
    registrationId: string
  ): Promise<RegistrationInvoiceFacts> {
    const rows = [...paymentsById.values()].filter(
      (row) => row.tenantId === tenantId && row.registrationId === registrationId
    );
    let paid = BigInt(0);
    const paymentAmountsMinor: string[] = [];
    let currency = "IRR";
    for (const row of rows) {
      const digits = row.amount.replace(/\D/g, "") || "0";
      paymentAmountsMinor.push(digits);
      if (row.currency.length > 0) {
        currency = row.currency;
      }
      if (row.status === "Paid") {
        paid += BigInt(digits);
      }
    }
    let prepayment = BigInt(0);
    for (const row of prepaymentsByDomainEventId.values()) {
      if (row.tenantId === tenantId && row.registrationId === registrationId) {
        prepayment += BigInt(row.amountMinor.replace(/\D/g, "") || "0");
        if (row.currency.length > 0) {
          currency = row.currency;
        }
      }
    }
    const refundedCompletedMinor = await this.sumCompletedRefundsMinor({
      tenantId,
      registrationId,
    });
    return {
      prepaymentMinor: prepayment.toString(),
      paidPaymentsMinor: paid.toString(),
      paymentAmountsMinor,
      currency,
      refundedCompletedMinor,
    };
  }

  async createRefund(input: CreateRefundInput): Promise<FinanceRefundRow> {
    if (input.creationIdempotencyKey) {
      const existing = await this.findRefundByCreationIdempotencyKey(
        input.tenantId,
        input.creationIdempotencyKey
      );
      if (existing !== null) {
        return existing;
      }
    }
    const requestedAt = new Date(input.requestedAtIso);
    const row: FinanceRefundRow = {
      id: randomUUID(),
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      paymentId: input.paymentId,
      sourceKind: input.sourceKind,
      amountMinor: input.amountMinor,
      currency: input.currency.toUpperCase(),
      reasonCode: input.reasonCode,
      reasonNote: input.reasonNote,
      status: "Requested",
      requestedAt,
      requestedByUserId: input.requestedByUserId,
      approvedAt: null,
      approvedByUserId: null,
      rejectedAt: null,
      rejectedByUserId: null,
      rejectNote: null,
      cancelledAt: null,
      cancelledByUserId: null,
      completedAt: null,
      completedByUserId: null,
      completionNote: null,
      evidenceFileKey: input.evidenceFileKey ?? null,
      evidenceNote: input.evidenceNote ?? null,
      creationIdempotencyKey: input.creationIdempotencyKey ?? null,
    };
    refundsById.set(row.id, row);
    return row;
  }

  async findRefundById(tenantId: string, refundId: string): Promise<FinanceRefundRow | null> {
    const row = refundsById.get(refundId);
    if (row === undefined || row.tenantId !== tenantId) {
      return null;
    }
    return row;
  }

  async findRefundByCreationIdempotencyKey(
    tenantId: string,
    creationIdempotencyKey: string
  ): Promise<FinanceRefundRow | null> {
    for (const row of refundsById.values()) {
      if (
        row.tenantId === tenantId &&
        row.creationIdempotencyKey === creationIdempotencyKey
      ) {
        return row;
      }
    }
    return null;
  }

  async listRefundsForRegistration(
    tenantId: string,
    registrationId: string
  ): Promise<readonly FinanceRefundRow[]> {
    return [...refundsById.values()]
      .filter((row) => row.tenantId === tenantId && row.registrationId === registrationId)
      .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
  }

  async listRefundsPage(query: ListRefundsPageQuery): Promise<ListRefundsPageResult> {
    const limit = Math.max(1, Math.floor(query.limit));
    let rows = [...refundsById.values()].filter((row) => row.tenantId === query.tenantId);
    if (query.registrationId !== undefined) {
      rows = rows.filter((row) => row.registrationId === query.registrationId);
    }
    if (query.status !== undefined) {
      rows = rows.filter((row) => row.status === query.status);
    }
    const cursorRaw = query.cursor;
    if (cursorRaw !== undefined && cursorRaw !== null) {
      const cursorAt = new Date(cursorRaw.requestedAt);
      if (!Number.isNaN(cursorAt.getTime()) && cursorRaw.id.length > 0) {
        rows = rows.filter((row) =>
          isOlderThanOperatorRefundCursor(row, {
            requestedAt: cursorAt,
            id: cursorRaw.id,
          })
        );
      }
    }
    rows.sort(compareOperatorRefundOrder);
    const hasMore = rows.length > limit;
    return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
  }

  async sumCompletedRefundsMinor(query: SumCompletedRefundsQuery): Promise<string> {
    let sum = BigInt(0);
    for (const row of refundsById.values()) {
      if (row.tenantId !== query.tenantId || row.registrationId !== query.registrationId) {
        continue;
      }
      if (row.status !== "Completed") {
        continue;
      }
      if (query.excludeRefundId !== undefined && row.id === query.excludeRefundId) {
        continue;
      }
      if (query.paymentId !== undefined && row.paymentId !== query.paymentId) {
        continue;
      }
      if (query.sourceKind !== undefined && row.sourceKind !== query.sourceKind) {
        continue;
      }
      sum += BigInt(row.amountMinor.replace(/\D/g, "") || "0");
    }
    return sum.toString();
  }

  async transitionRefundStatus(
    input: TransitionRefundStatusInput
  ): Promise<{ readonly refund: FinanceRefundRow; readonly replay: boolean }> {
    const existing = refundsById.get(input.refundId);
    if (existing === undefined || existing.tenantId !== input.tenantId) {
      throw new Error("REFUND_NOT_FOUND");
    }
    if (existing.status === input.toStatus) {
      if (input.toStatus === "Completed" || input.toStatus === "Approved") {
        return { refund: existing, replay: true };
      }
      throw new Error("REFUND_NOT_TRANSITIONABLE");
    }
    if (!(input.fromStatuses as readonly string[]).includes(existing.status)) {
      throw new Error("REFUND_NOT_TRANSITIONABLE");
    }
    const occurredAt = new Date(input.occurredAtIso);
    const next: FinanceRefundRow = {
      ...existing,
      status: input.toStatus,
      ...(input.toStatus === "Approved"
        ? { approvedAt: occurredAt, approvedByUserId: input.actorUserId }
        : {}),
      ...(input.toStatus === "Rejected"
        ? {
            rejectedAt: occurredAt,
            rejectedByUserId: input.actorUserId,
            rejectNote: input.rejectNote ?? null,
          }
        : {}),
      ...(input.toStatus === "Cancelled"
        ? { cancelledAt: occurredAt, cancelledByUserId: input.actorUserId }
        : {}),
      ...(input.toStatus === "Completed"
        ? {
            completedAt: occurredAt,
            completedByUserId: input.actorUserId,
            completionNote: input.completionNote ?? null,
          }
        : {}),
    };
    refundsById.set(next.id, next);
    return { refund: next, replay: false };
  }
}
