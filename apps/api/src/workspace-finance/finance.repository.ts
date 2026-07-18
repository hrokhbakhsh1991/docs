import { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import type { BookingPaymentStatus } from "../bookings/bookings.types";
import { loadRegistrationInvoiceFacts } from "../finance/load-registration-invoice-facts";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
import { enqueueFinanceLedgerCaptureOutbox } from "./enqueue-finance-ledger-capture";
import { MAX_PAYMENTS_PER_REGISTRATION } from "./finance-list-projection";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter";
import type {
  FinanceLedgerCapturePlan,
  FinanceLedgerJournalLine,
} from "./ports/finance-ledger-policy.port";
import type { IBookingPaymentPort } from "./ports/booking-payment.port";
import { createTxScopedOutboxWriter } from "./prisma-workspace-outbox-writer";
import { shouldAbortAtomicTx } from "../test-hooks/atomic-tx-test-abort";

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
  constructor(
    private readonly bookingPayments: IBookingPaymentPort = new BookingPaymentAdapter()
  ) {}

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
      if (input.creationIdempotencyKey !== undefined) {
        const existingByKey = await tx.payment.findFirst({
          where: {
            tenantId: input.tenantId,
            creationIdempotencyKey: input.creationIdempotencyKey,
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
        if (existingByKey !== null) {
          if (
            existingByKey.registrationId !== input.registrationId ||
            existingByKey.amount !== input.amount ||
            existingByKey.currency !== input.currency.toUpperCase()
          ) {
            throw new Error("FINANCE_PAYMENT_IDEMPOTENCY_CONFLICT");
          }
          return existingByKey;
        }
      }
      try {
        const row = await tx.payment.create({
          data: {
            tenantId: input.tenantId,
            registrationId: input.registrationId,
            amount: input.amount,
            currency: input.currency.toUpperCase(),
            method: input.method,
            provider: input.provider,
            status: input.status,
            ...(input.creationIdempotencyKey !== undefined
              ? { creationIdempotencyKey: input.creationIdempotencyKey }
              : {}),
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
      } catch (error) {
        if (
          input.creationIdempotencyKey !== undefined &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const existing = await tx.payment.findFirst({
            where: {
              tenantId: input.tenantId,
              creationIdempotencyKey: input.creationIdempotencyKey,
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
          if (existing === null) {
            throw error;
          }
          if (
            existing.registrationId !== input.registrationId ||
            existing.amount !== input.amount ||
            existing.currency !== input.currency.toUpperCase()
          ) {
            throw new Error("FINANCE_PAYMENT_IDEMPOTENCY_CONFLICT");
          }
          return existing;
        }
        throw error;
      }
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

  async findPaymentByCreationIdempotencyKey(
    tenantId: string,
    creationIdempotencyKey: string
  ): Promise<FinancePaymentRow | null> {
    return withTenantRls(tenantId, async (tx) => {
      return tx.payment.findFirst({
        where: { tenantId, creationIdempotencyKey },
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
      if (input.idempotencyKeyHash !== undefined) {
        const byHash = await tx.paymentReceipt.findFirst({
          where: {
            tenantId: input.tenantId,
            idempotencyKeyHash: input.idempotencyKeyHash,
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
        if (byHash !== null) {
          if (
            byHash.paymentId !== input.paymentId ||
            byHash.fileKey !== input.fileKey ||
            (input.note !== undefined && byHash.note !== (input.note ?? null))
          ) {
            throw new Error("FINANCE_RECEIPT_IDEMPOTENCY_CONFLICT");
          }
          return byHash;
        }
      }

      const pendingCount = await tx.paymentReceipt.count({
        where: {
          tenantId: input.tenantId,
          paymentId: input.paymentId,
          status: "Pending",
        },
      });
      if (pendingCount > 0) {
        throw new Error("ZOD_VALIDATION_FAILED: payment already has a pending receipt");
      }

      try {
        const row = await tx.paymentReceipt.create({
          data: {
            tenantId: input.tenantId,
            paymentId: input.paymentId,
            fileKey: input.fileKey,
            status: "Pending",
            note: input.note ?? null,
            ...(input.idempotencyKeyHash !== undefined
              ? { idempotencyKeyHash: input.idempotencyKeyHash }
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
        return row;
      } catch (error) {
        if (
          input.idempotencyKeyHash !== undefined &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const existing = await tx.paymentReceipt.findFirst({
            where: {
              tenantId: input.tenantId,
              idempotencyKeyHash: input.idempotencyKeyHash,
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
          if (existing === null) {
            throw error;
          }
          if (
            existing.paymentId !== input.paymentId ||
            existing.fileKey !== input.fileKey ||
            (input.note !== undefined && existing.note !== (input.note ?? null))
          ) {
            throw new Error("FINANCE_RECEIPT_IDEMPOTENCY_CONFLICT");
          }
          return existing;
        }
        throw error;
      }
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
      if (shouldAbortAtomicTx("finance_approve_before_commit")) {
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

      if (shouldAbortAtomicTx("finance_approve_after_payment")) {
        throw new Error("P5_ATOMIC_TX_TEST_ABORT");
      }

      let bookingPaymentStatus: BookingPaymentStatus;
      try {
        bookingPaymentStatus = await this.bookingPayments.raisePaidInTx(tx, {
          tenantId: input.tenantId,
          registrationId: input.registrationId,
        });
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          (error.message === "FINANCE_BOOKING_PAYMENT_SYNC_MISS" ||
            error.message === "FINANCE_BOOKING_PAYMENT_SYNC_FAILED" ||
            error.message === "P5_ATOMIC_TX_TEST_ABORT")
        ) {
          throw error;
        }
        throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_FAILED");
      }

      if (shouldAbortAtomicTx("finance_approve_after_booking")) {
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

      if (shouldAbortAtomicTx("finance_approve_after_receipt")) {
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

        if (shouldAbortAtomicTx("finance_prepayment_before_commit")) {
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

        if (shouldAbortAtomicTx("finance_prepayment_after_ledger")) {
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

  async recordPrepaymentBookingSyncDegraded(input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly paymentStatus: string;
    readonly error: string;
    readonly prepaymentDomainEventId: string;
  }): Promise<void> {
    const domainEventId = `prepay-booking-sync-degraded:${input.registrationId}`.slice(0, 128);
    await withTenantRls(input.tenantId, async (tx) => {
      await enqueueOutboxEvent(tx, {
        tenantId: input.tenantId,
        aggregateType: "registration",
        aggregateId: input.registrationId,
        eventType: "finance.prepayment.booking_sync.degraded",
        domainEventId,
        payload: {
          registrationId: input.registrationId,
          paymentStatus: input.paymentStatus,
          error: input.error,
          prepaymentDomainEventId: input.prepaymentDomainEventId,
          degradedAt: new Date().toISOString(),
        },
      });
    });
  }

  async listOpenPrepaymentBookingSyncDegraded(
    tenantId: string,
    limit: number
  ): Promise<
    readonly {
      readonly registrationId: string;
      readonly paymentStatus: string;
      readonly error: string;
      readonly prepaymentDomainEventId: string | null;
      readonly degradedAt: string;
    }[]
  > {
    return withTenantRls(tenantId, async (tx) => {
      const recovered = await tx.outboxEvent.findMany({
        where: {
          tenantId,
          eventType: "finance.prepayment.booking_sync.recovered",
        },
        select: { aggregateId: true },
      });
      const recoveredIds = new Set(recovered.map((row) => row.aggregateId));
      const rows = await tx.outboxEvent.findMany({
        where: {
          tenantId,
          eventType: "finance.prepayment.booking_sync.degraded",
        },
        orderBy: { createdAt: "desc" },
        take: limit * 2,
        select: {
          aggregateId: true,
          payload: true,
          createdAt: true,
        },
      });
      const out: {
        registrationId: string;
        paymentStatus: string;
        error: string;
        prepaymentDomainEventId: string | null;
        degradedAt: string;
      }[] = [];
      for (const row of rows) {
        if (recoveredIds.has(row.aggregateId)) {
          continue;
        }
        const payload =
          row.payload !== null && typeof row.payload === "object"
            ? (row.payload as Record<string, unknown>)
            : {};
        out.push({
          registrationId: row.aggregateId,
          paymentStatus: String(payload.paymentStatus ?? "partial"),
          error: String(payload.error ?? ""),
          prepaymentDomainEventId:
            typeof payload.prepaymentDomainEventId === "string"
              ? payload.prepaymentDomainEventId
              : null,
          degradedAt:
            typeof payload.degradedAt === "string"
              ? payload.degradedAt
              : row.createdAt.toISOString(),
        });
        if (out.length >= limit) {
          break;
        }
      }
      return out;
    });
  }

  async markPrepaymentBookingSyncRecovered(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<void> {
    const domainEventId = `prepay-booking-sync-recovered:${input.registrationId}`.slice(0, 128);
    await withTenantRls(input.tenantId, async (tx) => {
      await enqueueOutboxEvent(tx, {
        tenantId: input.tenantId,
        aggregateType: "registration",
        aggregateId: input.registrationId,
        eventType: "finance.prepayment.booking_sync.recovered",
        domainEventId,
        payload: {
          registrationId: input.registrationId,
          recoveredAt: new Date().toISOString(),
        },
      });
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
