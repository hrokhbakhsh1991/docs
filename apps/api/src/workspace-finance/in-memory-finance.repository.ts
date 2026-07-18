import { randomUUID } from "node:crypto";

import type {
  ApproveManualReceiptAtomicInput,
  ApproveManualReceiptAtomicResult,
  CreatePaymentInput,
  CreateReceiptInput,
  FinanceLedgerOutboxRow,
  FinanceOpenPaymentRow,
  FinancePaymentRow,
  FinanceReceiptRow,
  FinanceSummaryRow,
} from "./finance.repository";
import type { IBookingPaymentPort } from "./ports/booking-payment.port";

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

export function resetInMemoryFinanceRepositoryForTests(): void {
  paymentsById = new Map();
  receiptsById = new Map();
  ledgerEvents = [];
}

/**
 * Unit-test fake only — not production-equivalent to Prisma `approveManualReceiptAtomic`.
 * Atomicity / concurrency / HTTP idempotency proofs require STORAGE_DRIVER=prisma.
 */
export class InMemoryFinanceRepository {
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

  async listPendingReceipts(tenantId: string, limit: number): Promise<FinanceReceiptRow[]> {
    return [...receiptsById.values()]
      .filter((row) => row.tenantId === tenantId && row.status === "Pending")
      .slice(0, limit);
  }

  async updateReceiptReview(
    tenantId: string,
    receiptId: string,
    input: {
      readonly status: "Approved" | "Rejected";
      readonly reviewedByUserId: string;
      readonly reviewNote?: string;
      readonly ledgerJournalId?: string;
    }
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
    await this.markPaymentPaid(input.tenantId, input.paymentId, input.journalId);

    let bookingPaymentStatus: ApproveManualReceiptAtomicResult["bookingPaymentStatus"];
    try {
      const updatedStatus = await this.bookingPayments.syncStatus({
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        paymentStatus: "paid",
      });
      if (updatedStatus === null) {
        throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_MISS");
      }
      bookingPaymentStatus = updatedStatus;
    } catch (error: unknown) {
      await this.revertPaymentToPending(input.tenantId, input.paymentId);
      if (error instanceof Error && error.message === "FINANCE_BOOKING_PAYMENT_SYNC_MISS") {
        throw error;
      }
      console.warn(
        JSON.stringify({
          event: "finance.booking_payment_sync.failed",
          tenantId: input.tenantId,
          registrationId: input.registrationId,
          paymentStatus: "paid",
          error: error instanceof Error ? error.message : String(error),
        })
      );
      throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_FAILED");
    }

    const updated = await this.updateReceiptReview(input.tenantId, input.receiptId, {
      status: "Approved",
      reviewedByUserId: input.reviewedByUserId,
      reviewNote: input.reviewNote,
      ledgerJournalId: input.journalId,
    });

    return {
      id: updated.id,
      status: updated.status,
      reviewNote: updated.reviewNote,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      ledgerJournalId: input.journalId,
      bookingPaymentStatus,
    };
  }

  async listPrepayments(): Promise<readonly never[]> {
    return [];
  }

  async recordPrepaymentAtomic(): Promise<never> {
    throw new Error("FINANCE_MEMORY_DRIVER_READ_ONLY_PREPAYMENT");
  }

  async recordPrepaymentBookingSyncDegraded(): Promise<void> {
    /* memory fake — no durable degraded signal */
  }

  async listOpenPrepaymentBookingSyncDegraded(): Promise<readonly never[]> {
    return [];
  }

  async markPrepaymentBookingSyncRecovered(): Promise<void> {
    /* memory fake */
  }

  async getRegistrationInvoiceFacts(
    _tenantId: string,
    _registrationId: string
  ): Promise<{
    readonly prepaymentMinor: string;
    readonly paidPaymentsMinor: string;
    readonly paymentAmountsMinor: readonly string[];
    readonly currency: string;
  }> {
    return {
      prepaymentMinor: "0",
      paidPaymentsMinor: "0",
      paymentAmountsMinor: [],
      currency: "IRR",
    };
  }
}
