import { randomUUID } from "node:crypto";

import type {
  CreatePaymentInput,
  CreateReceiptInput,
  FinanceLedgerOutboxRow,
  FinanceOpenPaymentRow,
  FinancePaymentRow,
  FinanceReceiptRow,
  FinanceSummaryRow,
} from "./finance.repository";

type StoredPayment = FinancePaymentRow & { readonly tenantId: string };
type StoredReceipt = FinanceReceiptRow & { readonly tenantId: string };

let paymentsById = new Map<string, StoredPayment>();
let receiptsById = new Map<string, StoredReceipt>();
let ledgerEvents: FinanceLedgerOutboxRow[] = [];

export function resetInMemoryFinanceRepositoryForTests(): void {
  paymentsById = new Map();
  receiptsById = new Map();
  ledgerEvents = [];
}

export class InMemoryFinanceRepository {
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
    const now = new Date();
    const row: StoredPayment = {
      id: randomUUID(),
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      amount: input.amount,
      currency: input.currency,
      method: input.method,
      provider: input.provider,
      status: input.status,
      paidAt: null,
      createdAt: now,
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

  async countPendingReceiptsForPayment(tenantId: string, paymentId: string): Promise<number> {
    let count = 0;
    for (const receipt of receiptsById.values()) {
      if (receipt.tenantId === tenantId && receipt.paymentId === paymentId && receipt.status === "Pending") {
        count += 1;
      }
    }
    return count;
  }

  async createReceipt(input: CreateReceiptInput): Promise<FinanceReceiptRow> {
    const payment = await this.findPaymentById(input.tenantId, input.paymentId);
    if (payment === null) {
      throw new Error("FINANCE_PAYMENT_NOT_FOUND");
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
      createdAt: now,
      payment,
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
    void input.ledgerJournalId;
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
      eventType: "finance.ledger.double_entry.applied",
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

  async listPrepayments(): Promise<readonly never[]> {
    return [];
  }

  async recordPrepayment(): Promise<never> {
    throw new Error("FINANCE_MEMORY_DRIVER_READ_ONLY_PREPAYMENT");
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
