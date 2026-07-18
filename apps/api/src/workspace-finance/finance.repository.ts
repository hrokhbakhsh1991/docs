import { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import { raiseBookingPaymentStatus } from "../bookings/booking-payment-status";
import type { BookingPaymentStatus } from "../bookings/bookings.types";
import { loadRegistrationInvoiceFacts } from "../finance/load-registration-invoice-facts";
import { enqueueFinanceLedgerCaptureOutbox } from "./enqueue-finance-ledger-capture";
import { MAX_PAYMENTS_PER_REGISTRATION } from "./finance-list-projection";
import type {
  FinanceLedgerCapturePlan,
  FinanceLedgerJournalLine,
} from "./ports/finance-ledger-policy.port";
import { createTxScopedOutboxWriter } from "./prisma-workspace-outbox-writer";

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
};

export type CreateReceiptInput = {
  readonly tenantId: string;
  readonly paymentId: string;
  readonly fileKey: string;
  readonly note?: string;
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
  readonly bookingPaymentStatus: BookingPaymentStatus;
};

const PAYMENT_ROW_SELECT = {
  id: true,
  registrationId: true,
  amount: true,
  currency: true,
  method: true,
  status: true,
  provider: true,
  paidAt: true,
  createdAt: true,
} as const;

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

  async findLatestReceiptForRegistration(
    tenantId: string,
    registrationId: string
  ): Promise<FinanceReceiptRow | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.paymentReceipt.findFirst({
        where: {
          tenantId,
          payment: { tenantId, registrationId },
        },
        orderBy: { createdAt: "desc" },
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
        select: {
          id: true,
          paymentId: true,
          fileKey: true,
          status: true,
          note: true,
          reviewNote: true,
          reviewedAt: true,
          ledgerJournalId: true,
          createdAt: true,
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

  /** Compensating write when booking payment projection fails after markPaymentPaid. */
  async revertPaymentToPending(tenantId: string, paymentId: string): Promise<FinancePaymentRow> {
    return withTenantRls(tenantId, async (tx) => {
      return tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "Pending",
          paidAt: null,
          ledgerJournalId: null,
        },
        select: PAYMENT_ROW_SELECT,
      });
    });
  }

  /**
   * Approve path — single tenant RLS transaction:
   * payment Paid → booking paymentStatus paid → receipt Approved → outbox (last).
   */
  async approveManualReceiptAtomic(
    input: ApproveManualReceiptAtomicInput
  ): Promise<ApproveManualReceiptAtomicResult> {
    return withTenantRls(input.tenantId, async (tx) => {
      if (process.env.P5_ATOMIC_TX_TEST_ABORT === "finance_approve_before_commit") {
        throw new Error("P5_ATOMIC_TX_TEST_ABORT");
      }

      const paymentUpdated = await tx.payment.updateMany({
        where: {
          id: input.paymentId,
          tenantId: input.tenantId,
          status: "Pending",
        },
        data: {
          status: "Paid",
          paidAt: new Date(),
          ledgerJournalId: input.journalId,
        },
      });
      if (paymentUpdated.count !== 1) {
        throw new Error("FINANCE_APPROVE_CONFLICT");
      }

      if (process.env.P5_ATOMIC_TX_TEST_ABORT === "finance_approve_after_payment") {
        throw new Error("P5_ATOMIC_TX_TEST_ABORT");
      }

      let bookingPaymentStatus: BookingPaymentStatus;
      try {
        const booking = await tx.operatorRegistration.findFirst({
          where: { id: input.registrationId, tenantId: input.tenantId },
          select: { id: true, paymentStatus: true },
        });
        if (booking === null) {
          throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_MISS");
        }
        const current = booking.paymentStatus as BookingPaymentStatus;
        bookingPaymentStatus = raiseBookingPaymentStatus(current, "paid");
        if (bookingPaymentStatus !== current) {
          await tx.operatorRegistration.update({
            where: { id: input.registrationId },
            data: { paymentStatus: bookingPaymentStatus },
          });
        }
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          (error.message === "FINANCE_BOOKING_PAYMENT_SYNC_MISS" ||
            error.message === "P5_ATOMIC_TX_TEST_ABORT")
        ) {
          throw error;
        }
        throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_FAILED");
      }

      if (process.env.P5_ATOMIC_TX_TEST_ABORT === "finance_approve_after_booking") {
        throw new Error("P5_ATOMIC_TX_TEST_ABORT");
      }

      const receiptUpdated = await tx.paymentReceipt.updateMany({
        where: {
          id: input.receiptId,
          tenantId: input.tenantId,
          status: "Pending",
        },
        data: {
          status: "Approved",
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote ?? null,
          ledgerJournalId: input.journalId,
        },
      });
      if (receiptUpdated.count !== 1) {
        throw new Error("FINANCE_APPROVE_CONFLICT");
      }

      const updated = await tx.paymentReceipt.findFirstOrThrow({
        where: { id: input.receiptId, tenantId: input.tenantId },
        select: {
          id: true,
          status: true,
          reviewNote: true,
          reviewedAt: true,
        },
      });

      if (process.env.P5_ATOMIC_TX_TEST_ABORT === "finance_approve_after_receipt") {
        throw new Error("P5_ATOMIC_TX_TEST_ABORT");
      }

      if (input.ledgerCapture !== undefined && input.ledgerCapture.lines.length > 0) {
        const inserted = await enqueueFinanceLedgerCaptureOutbox({
          outboxWriter: createTxScopedOutboxWriter(tx),
          tenantId: input.tenantId,
          registrationId: input.registrationId,
          capture: input.ledgerCapture,
        });
        if (!inserted) {
          throw new Error("FINANCE_APPROVE_CONFLICT");
        }
      }

      return {
        id: updated.id,
        status: updated.status,
        reviewNote: updated.reviewNote,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
        ledgerJournalId: input.journalId,
        bookingPaymentStatus,
      };
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
          recordedAt:
            typeof payload.recordedAt === "string"
              ? payload.recordedAt
              : row.createdAt.toISOString(),
        };
      });
    });
  }

  /**
   * Phase 3A — single RLS transaction: ledger outbox + finance.prepayment.recorded.
   * Idempotent on `prepaymentDomainEventId` (stable client operation identity).
   */
  async recordPrepaymentAtomic(input: {
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
  }): Promise<{
    readonly created: boolean;
    readonly id: string;
    readonly registrationId: string;
    readonly amountMinor: string;
    readonly currency: string;
    readonly method: string;
    readonly note: string | null;
    readonly recordedAt: string;
  }> {
    const mapExistingRow = (existing: {
      readonly id: string;
      readonly payload: unknown;
      readonly createdAt: Date;
    }) => {
      const payload =
        existing.payload !== null && typeof existing.payload === "object"
          ? (existing.payload as Record<string, unknown>)
          : {};
      return {
        created: false as const,
        id: existing.id,
        registrationId: String(payload.registrationId ?? input.registrationId),
        amountMinor: String(payload.amountMinor ?? input.amountMinor),
        currency: String(payload.currency ?? input.currency),
        method: String(payload.method ?? input.method),
        note: typeof payload.note === "string" ? payload.note : input.note,
        recordedAt:
          typeof payload.recordedAt === "string"
            ? payload.recordedAt
            : existing.createdAt.toISOString(),
      };
    };

    const loadExisting = async () =>
      withTenantRls(input.tenantId, async (tx) => {
        const existing = await tx.outboxEvent.findFirst({
          where: {
            tenantId: input.tenantId,
            domainEventId: input.prepaymentDomainEventId,
            eventType: "finance.prepayment.recorded",
          },
          select: { id: true, payload: true, createdAt: true },
        });
        return existing === null ? null : mapExistingRow(existing);
      });

    try {
      return await withTenantRls(input.tenantId, async (tx) => {
        const existing = await tx.outboxEvent.findFirst({
          where: {
            tenantId: input.tenantId,
            domainEventId: input.prepaymentDomainEventId,
            eventType: "finance.prepayment.recorded",
          },
          select: { id: true, payload: true, createdAt: true },
        });
        if (existing !== null) {
          return mapExistingRow(existing);
        }

        if (process.env.P5_ATOMIC_TX_TEST_ABORT === "finance_prepayment_before_commit") {
          throw new Error("P5_ATOMIC_TX_TEST_ABORT");
        }

        await enqueueFinanceLedgerCaptureOutbox({
          outboxWriter: createTxScopedOutboxWriter(tx),
          tenantId: input.tenantId,
          registrationId: input.registrationId,
          capture: {
            journalId: input.journalId,
            domainEventId: input.ledgerDomainEventId,
            lines: input.lines,
          },
        });

        if (process.env.P5_ATOMIC_TX_TEST_ABORT === "finance_prepayment_after_ledger") {
          throw new Error("P5_ATOMIC_TX_TEST_ABORT");
        }

        const row = await tx.outboxEvent.create({
          data: {
            tenantId: input.tenantId,
            eventType: "finance.prepayment.recorded",
            aggregateType: "registration",
            aggregateId: input.registrationId,
            domainEventId: input.prepaymentDomainEventId,
            payload: {
              registrationId: input.registrationId,
              amountMinor: input.amountMinor,
              currency: input.currency,
              method: input.method,
              note: input.note,
              journalId: input.journalId,
              recordedAt: input.recordedAt,
              clientOperationKeyHash: input.clientOperationKeyHash,
            },
          },
          select: { id: true },
        });
        return {
          created: true,
          id: row.id,
          registrationId: input.registrationId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          method: input.method,
          note: input.note,
          recordedAt: input.recordedAt,
        };
      });
    } catch (error: unknown) {
      const isUniqueConflict =
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
        (error instanceof Error && error.message === "FINANCE_PREPAYMENT_CONFLICT");
      if (isUniqueConflict) {
        const replay = await loadExisting();
        if (replay !== null) {
          return replay;
        }
        throw new Error("FINANCE_PREPAYMENT_CONFLICT");
      }
      throw error;
    }
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
