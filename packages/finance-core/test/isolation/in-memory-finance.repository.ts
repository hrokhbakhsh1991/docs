/**
 * Extraction-simulation in-memory FinanceRepositoryPort (test-only).
 * Lives under finance-core/test — must not import apps/api.
 * Not production-equivalent to Prisma RLS / outbox atomics.
 */
import { randomUUID } from "node:crypto";

import type {
  ApproveManualReceiptAtomicInput,
  ApproveManualReceiptAtomicResult,
  CreatePaymentInput,
  CreateReceiptInput,
  FinanceLedgerOutboxRow,
  FinanceOpenPaymentRow,
  FinancePaymentRow,
  FinancePrepaymentListRow,
  FinanceReceiptRow,
  FinanceRepositoryPort,
  FinanceSummaryRow,
  FinanceTourPaymentAggregateRow,
  PrepaymentBookingSyncDegradedRow,
  RecordPrepaymentAtomicInput,
  RegistrationInvoiceFacts,
  UpdateReceiptReviewInput,
} from "../../src/ports/finance-repository.port.ts";
import type { IBookingPaymentPort } from "../../src/ports/booking-payment.port.ts";

type StoredPayment = FinancePaymentRow & {
  readonly tenantId: string;
  readonly creationIdempotencyKey?: string;
};
type StoredReceipt = FinanceReceiptRow & {
  readonly tenantId: string;
  readonly idempotencyKeyHash?: string;
};
type StoredLedgerEvent = FinanceLedgerOutboxRow & {
  readonly tenantId: string;
};

let paymentsById = new Map<string, StoredPayment>();
let receiptsById = new Map<string, StoredReceipt>();
let ledgerEvents: StoredLedgerEvent[] = [];
let prepaymentsByDomainEventId = new Map<string, FinancePrepaymentListRow & { readonly tenantId: string }>();


export function resetInMemoryFinanceRepositoryForTests(): void {
  paymentsById = new Map();
  receiptsById = new Map();
  ledgerEvents = [];
  prepaymentsByDomainEventId = new Map();
}

function toLedgerOutboxRow(row: StoredLedgerEvent): FinanceLedgerOutboxRow {
  return {
    id: row.id,
    eventType: row.eventType,
    payload: row.payload,
    createdAt: row.createdAt,
    domainEventId: row.domainEventId,
    aggregateId: row.aggregateId,
  };
}

/**
 * Unit-test fake only — not production-equivalent to Prisma `approveManualReceiptAtomic`.
 * Atomicity / concurrency / HTTP idempotency proofs require STORAGE_DRIVER=prisma.
 */
export class InMemoryFinanceRepository implements FinanceRepositoryPort {
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

  async listPaymentsByTourAggregate(): Promise<readonly FinanceTourPaymentAggregateRow[]> {
    return [];
  }

  async listLedgerEvents(tenantId: string, limit: number): Promise<FinanceLedgerOutboxRow[]> {
    return ledgerEvents
      .filter((row) => row.tenantId === tenantId)
      .slice(0, limit)
      .map(toLedgerOutboxRow);
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

  async listPendingReceipts(tenantId: string, limit: number): Promise<FinanceReceiptRow[]> {
    return [...receiptsById.values()]
      .filter((row) => row.tenantId === tenantId && row.status === "Pending")
      .slice(0, limit);
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
      if (paidPayment !== undefined && paidPayment.tenantId === tenantId) {
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
      if (receipt.tenantId === tenantId && receipt.paymentId === paymentId) {
        receiptsById.set(receiptId, { ...receipt, payment: updated });
      }
    }
    ledgerEvents.push({
      id: randomUUID(),
      tenantId,
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
      if (receipt.tenantId === tenantId && receipt.paymentId === paymentId) {
        receiptsById.set(receiptId, { ...receipt, payment: updated });
      }
    }
    // Fake-only: drop the provisional capture row so compensate does not leave orphan ledger facts.
    const captureDomainEventId = `payment:${paymentId}:ledger-capture-anchor`;
    ledgerEvents = ledgerEvents.filter(
      (event) =>
        !(event.tenantId === tenantId && event.domainEventId === captureDomainEventId)
    );
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
      bookingPaymentStatus = await this.bookingPayments.raisePaidInTx(
        {},
        {
          tenantId: input.tenantId,
          registrationId: input.registrationId,
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
        tenantId: input.tenantId,
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
      tenantId: input.tenantId,
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
      tenantId: input.tenantId,
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
    _tenantId: string,
    _registrationId: string
  ): Promise<RegistrationInvoiceFacts> {
    return {
      prepaymentMinor: "0",
      paidPaymentsMinor: "0",
      paymentAmountsMinor: [],
      currency: "IRR",
    };
  }
}
