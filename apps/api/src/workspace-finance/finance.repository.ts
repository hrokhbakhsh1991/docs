import { withTenantRls } from "../db/with-tenant-rls";
import { resolveStorageDriver } from "../storage/production-storage-driver-assert";
import { InMemoryFinanceRepository } from "./in-memory-finance.repository";

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
};

export type CreateReceiptInput = {
  readonly tenantId: string;
  readonly paymentId: string;
  readonly fileKey: string;
  readonly note?: string;
};

export class FinanceRepository {
  async getSummary(tenantId: string): Promise<FinanceSummaryRow> {
    return withTenantRls(tenantId, async (tx) => {
      const [pendingManualPayments, pendingReceiptReviews, paidPayments, failedPayments] =
        await Promise.all([
          tx.payment.count({
            where: { tenantId, method: "Manual", status: "Pending" },
          }),
          tx.paymentReceipt.count({
            where: { tenantId, status: "Pending" },
          }),
          tx.payment.count({
            where: { tenantId, status: "Paid" },
          }),
          tx.payment.count({
            where: { tenantId, status: "Failed" },
          }),
        ]);
      return {
        pendingManualPayments,
        pendingReceiptReviews,
        paidPayments,
        failedPayments,
      };
    });
  }

  async listOpenPayments(tenantId: string, limit: number): Promise<FinanceOpenPaymentRow[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.payment.findMany({
        where: { tenantId, status: "Pending" },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: {
          id: true,
          registrationId: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          createdAt: true,
        },
      });
      return rows;
    });
  }

  async listPayments(tenantId: string, limit: number): Promise<FinancePaymentRow[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.payment.findMany({
        where: { tenantId, method: "Manual" },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          registrationId: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          provider: true,
          paidAt: true,
          createdAt: true,
        },
      });
      return rows;
    });
  }

  async listLedgerEvents(tenantId: string, limit: number): Promise<FinanceLedgerOutboxRow[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.outboxEvent.findMany({
        where: {
          tenantId,
          eventType: { startsWith: "finance.ledger." },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          eventType: true,
          payload: true,
          createdAt: true,
          domainEventId: true,
          aggregateId: true,
        },
      });
      return rows.map((row) => ({
        ...row,
        payload: row.payload as unknown,
      }));
    });
  }

  async findPaymentStatusesByRegistration(
    tenantId: string,
    registrationId: string
  ): Promise<readonly string[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.payment.findMany({
        where: { tenantId, registrationId },
        select: { status: true },
      });
      return rows.map((row) => row.status);
    });
  }

  async createManualPayment(input: CreatePaymentInput): Promise<FinancePaymentRow> {
    return withTenantRls(input.tenantId, async (tx) => {
      const row = await tx.payment.create({
        data: {
          tenantId: input.tenantId,
          registrationId: input.registrationId,
          amount: input.amount,
          currency: input.currency.toUpperCase(),
          method: input.method,
          provider: input.provider,
          status: input.status,
        },
        select: {
          id: true,
          registrationId: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          provider: true,
          paidAt: true,
          createdAt: true,
        },
      });
      return row;
    });
  }

  async findPaymentById(tenantId: string, paymentId: string): Promise<FinancePaymentRow | null> {
    return withTenantRls(tenantId, async (tx) => {
      return tx.payment.findFirst({
        where: { tenantId, id: paymentId },
        select: {
          id: true,
          registrationId: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          provider: true,
          paidAt: true,
          createdAt: true,
        },
      });
    });
  }

  async findFirstPendingManualPayment(
    tenantId: string,
    registrationId: string
  ): Promise<FinancePaymentRow | null> {
    return withTenantRls(tenantId, async (tx) => {
      return tx.payment.findFirst({
        where: {
          tenantId,
          registrationId,
          method: "Manual",
          status: "Pending",
        },
        select: {
          id: true,
          registrationId: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          provider: true,
          paidAt: true,
          createdAt: true,
        },
      });
    });
  }

  async countPendingReceiptsForPayment(tenantId: string, paymentId: string): Promise<number> {
    return withTenantRls(tenantId, async (tx) => {
      return tx.paymentReceipt.count({
        where: { tenantId, paymentId, status: "Pending" },
      });
    });
  }

  async createReceipt(input: CreateReceiptInput): Promise<FinanceReceiptRow> {
    return withTenantRls(input.tenantId, async (tx) => {
      const row = await tx.paymentReceipt.create({
        data: {
          tenantId: input.tenantId,
          paymentId: input.paymentId,
          fileKey: input.fileKey,
          status: "Pending",
          note: input.note ?? null,
        },
        include: {
          payment: {
            select: {
              id: true,
              registrationId: true,
              amount: true,
              currency: true,
              method: true,
              status: true,
              provider: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
      });
      return row;
    });
  }

  async findReceiptById(tenantId: string, receiptId: string): Promise<FinanceReceiptRow | null> {
    return withTenantRls(tenantId, async (tx) => {
      return tx.paymentReceipt.findFirst({
        where: { tenantId, id: receiptId },
        include: {
          payment: {
            select: {
              id: true,
              registrationId: true,
              amount: true,
              currency: true,
              method: true,
              status: true,
              provider: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
      });
    });
  }

  async listPendingReceipts(tenantId: string, limit: number): Promise<FinanceReceiptRow[]> {
    return withTenantRls(tenantId, async (tx) => {
      return tx.paymentReceipt.findMany({
        where: { tenantId, status: "Pending" },
        orderBy: { createdAt: "asc" },
        take: limit,
        include: {
          payment: {
            select: {
              id: true,
              registrationId: true,
              amount: true,
              currency: true,
              method: true,
              status: true,
              provider: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
      });
    });
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
    return withTenantRls(tenantId, async (tx) => {
      return tx.paymentReceipt.update({
        where: { id: receiptId },
        data: {
          status: input.status,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote ?? null,
          ...(input.ledgerJournalId !== undefined
            ? { ledgerJournalId: input.ledgerJournalId }
            : {}),
        },
        include: {
          payment: {
            select: {
              id: true,
              registrationId: true,
              amount: true,
              currency: true,
              method: true,
              status: true,
              provider: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
      });
    });
  }

  async markPaymentPaid(
    tenantId: string,
    paymentId: string,
    ledgerJournalId: string
  ): Promise<FinancePaymentRow> {
    return withTenantRls(tenantId, async (tx) => {
      return tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "Paid",
          paidAt: new Date(),
          ledgerJournalId,
        },
        select: {
          id: true,
          registrationId: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          provider: true,
          paidAt: true,
          createdAt: true,
        },
      });
    });
  }

  async listPrepayments(tenantId: string, limit: number): Promise<
    readonly {
      id: string;
      registrationId: string;
      amountMinor: string;
      currency: string;
      method: string;
      note: string | null;
      recordedAt: string;
    }[]
  > {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.outboxEvent.findMany({
        where: { tenantId, eventType: "finance.prepayment.recorded" },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          payload: true,
          createdAt: true,
        },
      });
      return rows.map((row) => {
        const payload =
          row.payload !== null && typeof row.payload === "object"
            ? (row.payload as Record<string, unknown>)
            : {};
        return {
          id: row.id,
          registrationId: String(payload.registrationId ?? ""),
          amountMinor: String(payload.amountMinor ?? "0"),
          currency: String(payload.currency ?? "IRR"),
          method: String(payload.method ?? "Manual"),
          note: typeof payload.note === "string" ? payload.note : null,
          recordedAt: row.createdAt.toISOString(),
        };
      });
    });
  }

  async recordPrepayment(input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly amountMinor: string;
    readonly currency: string;
    readonly method: string;
    readonly note: string | null;
    readonly journalId: string;
    readonly recordedAt: string;
  }) {
    return withTenantRls(input.tenantId, async (tx) => {
      const row = await tx.outboxEvent.create({
        data: {
          tenantId: input.tenantId,
          eventType: "finance.prepayment.recorded",
          aggregateType: "registration",
          aggregateId: input.registrationId,
          domainEventId: `prepayment:${input.registrationId}:${input.amountMinor}:${input.recordedAt}`,
          payload: {
            registrationId: input.registrationId,
            amountMinor: input.amountMinor,
            currency: input.currency,
            method: input.method,
            note: input.note,
            journalId: input.journalId,
            recordedAt: input.recordedAt,
          },
        },
        select: { id: true },
      });
      return {
        id: row.id,
        registrationId: input.registrationId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        method: input.method,
        note: input.note,
        recordedAt: input.recordedAt,
      };
    });
  }

  async getRegistrationInvoiceFacts(
    tenantId: string,
    registrationId: string
  ): Promise<{
    readonly prepaymentMinor: string;
    readonly paidPaymentsMinor: string;
    readonly paymentAmountsMinor: readonly string[];
    readonly currency: string;
  }> {
    return withTenantRls(tenantId, async (tx) => {
      const prepaymentRows = await tx.outboxEvent.findMany({
        where: {
          tenantId,
          eventType: "finance.prepayment.recorded",
          aggregateId: registrationId,
        },
        select: { payload: true },
      });

      let prepaymentMinor = BigInt(0);
      let currency = "IRR";
      for (const row of prepaymentRows) {
        const payload =
          row.payload !== null && typeof row.payload === "object"
            ? (row.payload as Record<string, unknown>)
            : null;
        if (payload === null) {
          continue;
        }
        if (typeof payload.amountMinor === "string") {
          const digits = payload.amountMinor.replace(/\D/g, "");
          if (digits.length > 0) {
            prepaymentMinor += BigInt(digits);
          }
        }
        if (typeof payload.currency === "string" && payload.currency.length > 0) {
          currency = payload.currency;
        }
      }

      const payments = await tx.payment.findMany({
        where: { tenantId, registrationId },
        select: { amount: true, currency: true, status: true },
      });

      let paidPaymentsMinor = BigInt(0);
      const paymentAmountsMinor: string[] = [];
      for (const payment of payments) {
        const digits = payment.amount.replace(/\D/g, "") || "0";
        paymentAmountsMinor.push(digits);
        if (payment.currency.length > 0) {
          currency = payment.currency;
        }
        if (payment.status === "Paid") {
          paidPaymentsMinor += BigInt(digits);
        }
      }

      return {
        prepaymentMinor: prepaymentMinor.toString(),
        paidPaymentsMinor: paidPaymentsMinor.toString(),
        paymentAmountsMinor,
        currency,
      };
    });
  }
}

export type FinanceRepositoryPort = FinanceRepository | InMemoryFinanceRepository;

let financeRepositorySingleton: FinanceRepositoryPort | null = null;

export function createFinanceRepository(): FinanceRepositoryPort {
  if (financeRepositorySingleton !== null) {
    return financeRepositorySingleton;
  }
  if (resolveStorageDriver() === "memory") {
    financeRepositorySingleton = new InMemoryFinanceRepository();
  } else {
    financeRepositorySingleton = new FinanceRepository();
  }
  return financeRepositorySingleton;
}

export function resetFinanceRepositoryForTests(): void {
  financeRepositorySingleton = null;
}
