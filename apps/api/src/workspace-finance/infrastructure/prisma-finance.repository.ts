import { Prisma } from "@prisma/client";

import { withTenantRls } from "../../db/with-tenant-rls";
import { loadRegistrationInvoiceFacts } from "../../finance/load-registration-invoice-facts";
import { enqueueOutboxEvent } from "../../outbox/enqueue-domain-event";
import { shouldAbortAtomicTx } from "../../test-hooks/atomic-tx-test-abort";
import { enqueueFinanceLedgerCaptureOutbox } from "../enqueue-finance-ledger-capture";
import { MAX_PAYMENTS_PER_REGISTRATION } from "../finance-list-projection";
import {
  advisoryLockRegistrationWalletCredit,
  registrationHasTourCreatedWalletCredit,
} from "../registration-booking-wallet-credit";
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
  FinanceTourPaymentAggregateRow,
  FinanceTransactionPort,
  IBookingPaymentPort,
  ListFinanceExceptionSourcesResult,
  ListOutstandingBalanceCandidatesResult,
  ListPendingReceiptsPage,
  ListPendingReceiptsQuery,
  ListRefundsPageQuery,
  ListRefundsPageResult,
  PrepaymentBookingSyncDegradedRow,
  RecordPrepaymentAtomicInput,
  RecordPrepaymentAtomicResult,
  RegistrationInvoiceFacts,
  RefundReasonCode,
  RefundSourceKind,
  RefundStatus,
  SumCompletedRefundsQuery,
  TransitionRefundStatusInput,
  UpdateReceiptReviewInput,
} from "@app-tour/finance-core";
import {
  decodePendingReceiptCursor,
  encodePendingReceiptCursor,
  resolveApproveBookingPaymentStatus,
} from "@app-tour/finance-core/domain";
import { createTxScopedOutboxWriter } from "./prisma-workspace-outbox-writer";

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

/** Prisma select shape — never returned across {@link FinanceRepositoryPort}. */
type PaymentSelectShape = {
  readonly id: string;
  readonly registrationId: string;
  readonly amount: string;
  readonly currency: string;
  readonly method: string;
  readonly status: string;
  readonly provider: string;
  readonly paidAt: Date | null;
  readonly createdAt: Date;
};

type OpenPaymentSelectShape = {
  readonly id: string;
  readonly registrationId: string;
  readonly amount: string;
  readonly currency: string;
  readonly method: string;
  readonly status: string;
  readonly createdAt: Date;
};

type ReceiptSelectShape = {
  readonly id: string;
  readonly paymentId: string;
  readonly fileKey: string;
  readonly status: string;
  readonly note: string | null;
  readonly reviewNote: string | null;
  readonly reviewedAt: Date | null;
  readonly ledgerJournalId: string | null;
  readonly createdAt: Date;
  readonly payment?: PaymentSelectShape | null;
};

type LedgerOutboxSelectShape = {
  readonly id: string;
  readonly eventType: string;
  readonly payload: unknown;
  readonly createdAt: Date;
  readonly domainEventId: string | null;
  readonly aggregateId: string;
};

function toFinancePaymentRow(row: PaymentSelectShape): FinancePaymentRow {
  return {
    id: row.id,
    registrationId: row.registrationId,
    amount: row.amount,
    currency: row.currency,
    method: row.method,
    status: row.status,
    provider: row.provider,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
  };
}

function toFinanceOpenPaymentRow(row: OpenPaymentSelectShape): FinanceOpenPaymentRow {
  return {
    id: row.id,
    registrationId: row.registrationId,
    amount: row.amount,
    currency: row.currency,
    method: row.method,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function toFinanceReceiptRow(row: ReceiptSelectShape): FinanceReceiptRow {
  return {
    id: row.id,
    paymentId: row.paymentId,
    fileKey: row.fileKey,
    status: row.status,
    note: row.note,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt,
    ledgerJournalId: row.ledgerJournalId,
    createdAt: row.createdAt,
    payment: row.payment != null ? toFinancePaymentRow(row.payment) : null,
  };
}

function toFinanceLedgerOutboxRow(row: LedgerOutboxSelectShape): FinanceLedgerOutboxRow {
  return {
    id: row.id,
    eventType: row.eventType,
    payload: row.payload as unknown,
    createdAt: row.createdAt,
    domainEventId: row.domainEventId,
    aggregateId: row.aggregateId,
  };
}

/**
 * Prisma + tenant RLS implementation of {@link FinanceRepositoryPort}.
 * Approve / prepayment atomics and outbox enqueue stay here — not in FinanceService.
 * Domain DTOs are projected explicitly — Prisma model shapes never cross the port.
 */
export class PrismaFinanceRepository implements FinanceRepositoryPort {
  constructor(private readonly bookingPayments: IBookingPaymentPort) {}

  async getSummary(tenantId: string): Promise<FinanceSummaryRow> {
    return withTenantRls(tenantId, async (tx) => {
      const [
        pendingManualPayments,
        pendingReceiptReviews,
        paidPayments,
        failedPayments,
        cancelledPayments,
      ] = await Promise.all([
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
        tx.payment.count({
          where: { tenantId, status: "Cancelled" },
        }),
      ]);
      return {
        pendingManualPayments,
        pendingReceiptReviews,
        paidPayments,
        failedPayments,
        cancelledPayments,
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
      return rows.map(toFinanceOpenPaymentRow);
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
      return rows.map(toFinancePaymentRow);
    });
  }

  async listPaymentsByTourAggregate(
    tenantId: string,
    tourId?: string
  ): Promise<readonly FinanceTourPaymentAggregateRow[]> {
    return withTenantRls(tenantId, async (tx) => {
      const tourFilter =
        tourId !== undefined && tourId.trim().length > 0
          ? Prisma.sql`AND r.tour_id = ${tourId.trim()}::uuid`
          : Prisma.empty;
      const rows = await tx.$queryRaw<
        Array<{
          tour_id: string;
          tour_title: string;
          paid_count: bigint;
          paid_minor: string;
          pending_count: bigint;
        }>
      >(Prisma.sql`
        SELECT
          r.tour_id,
          COALESCE(MAX(r.tour_title), '') AS tour_title,
          COUNT(*) FILTER (WHERE p.status = 'Paid')::bigint AS paid_count,
          COALESCE(
            SUM(CASE WHEN p.status = 'Paid' THEN p.amount::numeric ELSE 0 END),
            0
          )::text AS paid_minor,
          COUNT(*) FILTER (WHERE p.status = 'Pending')::bigint AS pending_count
        FROM payments p
        INNER JOIN operator_registrations r
          ON r.id = p.registration_id AND r.tenant_id = p.tenant_id
        WHERE p.tenant_id = ${tenantId}::uuid
          ${tourFilter}
        GROUP BY r.tour_id
        ORDER BY r.tour_id ASC
      `);
      return rows.map((row) => ({
        tourId: row.tour_id,
        tourTitle: row.tour_title,
        paidCount: Number(row.paid_count),
        paidMinor: row.paid_minor,
        pendingCount: Number(row.pending_count),
      }));
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
      return rows.map(toFinanceLedgerOutboxRow);
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
        take: MAX_PAYMENTS_PER_REGISTRATION,
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
          return toFinancePaymentRow(existingByKey);
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
        return toFinancePaymentRow(row);
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
          return toFinancePaymentRow(existing);
        }
        throw error;
      }
    });
  }

  async findPaymentById(tenantId: string, paymentId: string): Promise<FinancePaymentRow | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.payment.findFirst({
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
      return row === null ? null : toFinancePaymentRow(row);
    });
  }

  async findPaymentByCreationIdempotencyKey(
    tenantId: string,
    creationIdempotencyKey: string
  ): Promise<FinancePaymentRow | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.payment.findFirst({
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
      return row === null ? null : toFinancePaymentRow(row);
    });
  }

  async findFirstPendingManualPayment(
    tenantId: string,
    registrationId: string
  ): Promise<FinancePaymentRow | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.payment.findFirst({
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
      return row === null ? null : toFinancePaymentRow(row);
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
      return row === null ? null : toFinanceReceiptRow(row);
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
          return toFinanceReceiptRow(byHash);
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
        return toFinanceReceiptRow(row);
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
          return toFinanceReceiptRow(existing);
        }
        throw error;
      }
    });
  }

  async findReceiptById(tenantId: string, receiptId: string): Promise<FinanceReceiptRow | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.paymentReceipt.findFirst({
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
      return row === null ? null : toFinanceReceiptRow(row);
    });
  }

  async listPendingReceipts(
    tenantId: string,
    query: ListPendingReceiptsQuery
  ): Promise<ListPendingReceiptsPage> {
    const limit = Math.max(1, Math.floor(query.limit));
    return withTenantRls(tenantId, async (tx) => {
      const paymentFilter: Prisma.PaymentWhereInput = {};
      if (query.registrationId !== undefined) {
        paymentFilter.registrationId = query.registrationId;
      } else if (query.registrationIds !== undefined) {
        if (query.registrationIds.length === 0) {
          return { rows: [], nextCursor: null, hasMore: false };
        }
        paymentFilter.registrationId = { in: [...query.registrationIds] };
      }

      const where: Prisma.PaymentReceiptWhereInput = {
        tenantId,
        status: "Pending",
        ...(Object.keys(paymentFilter).length > 0 ? { payment: paymentFilter } : {}),
      };

      if (typeof query.cursor === "string" && query.cursor.trim().length > 0) {
        const decoded = decodePendingReceiptCursor(query.cursor);
        if (decoded !== null) {
          where.AND = [
            {
              OR: [
                { createdAt: { gt: decoded.createdAt } },
                {
                  AND: [{ createdAt: decoded.createdAt }, { id: { gt: decoded.id } }],
                },
              ],
            },
          ];
        }
      }

      const rows = await tx.paymentReceipt.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit + 1,
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
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const mapped = page.map(toFinanceReceiptRow);
      const last = mapped[mapped.length - 1];
      const nextCursor =
        hasMore && last !== undefined
          ? encodePendingReceiptCursor({ createdAt: last.createdAt, id: last.id })
          : null;
      return { rows: mapped, nextCursor, hasMore };
    });
  }

  async listFinanceExceptionSources(
    tenantId: string
  ): Promise<ListFinanceExceptionSourcesResult> {
    return withTenantRls(tenantId, async (tx) => {
      type E1Raw = {
        payment_id: string;
        registration_id: string;
        amount: string;
        currency: string;
        method: string;
        receipt_id: string;
        review_note: string | null;
        occurred_at: Date;
      };
      const e1Rows = await tx.$queryRaw<E1Raw[]>`
        SELECT
          latest.payment_id,
          latest.registration_id,
          latest.amount,
          latest.currency,
          latest.method,
          latest.receipt_id,
          latest.review_note,
          latest.occurred_at
        FROM (
          SELECT DISTINCT ON (r.payment_id)
            p.id AS payment_id,
            p.registration_id,
            p.amount,
            p.currency,
            p.method,
            r.id AS receipt_id,
            r.review_note,
            COALESCE(r.reviewed_at, r.created_at) AS occurred_at,
            r.status AS receipt_status
          FROM payment_receipts r
          INNER JOIN payments p
            ON p.id = r.payment_id
           AND p.tenant_id = r.tenant_id
          WHERE r.tenant_id = ${tenantId}::uuid
            AND p.status = 'Pending'
          ORDER BY r.payment_id, r.created_at DESC, r.id DESC
        ) latest
        WHERE latest.receipt_status = 'Rejected'
      `;

      const cancelled = await tx.payment.findMany({
        where: { tenantId, status: "Cancelled" },
        select: {
          id: true,
          registrationId: true,
          amount: true,
          currency: true,
          method: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const cancelEvents = await tx.outboxEvent.findMany({
        where: {
          tenantId,
          eventType: "finance.payment.cancelled",
          aggregateId: { in: cancelled.map((row) => row.id) },
        },
        select: { aggregateId: true, payload: true, createdAt: true },
      });
      const cancelByPayment = new Map(
        cancelEvents.map((event) => [event.aggregateId, event] as const)
      );

      return {
        rejectedReceiptPendingPayments: e1Rows.map((row) => ({
          paymentId: row.payment_id,
          registrationId: row.registration_id,
          amount: row.amount,
          currency: row.currency,
          method: row.method,
          receiptId: row.receipt_id,
          reviewNote: row.review_note,
          occurredAt: row.occurred_at,
        })),
        cancelledPayments: cancelled.map((payment) => {
          const event = cancelByPayment.get(payment.id);
          const payload =
            event !== undefined &&
            typeof event.payload === "object" &&
            event.payload !== null
              ? (event.payload as { reasonCode?: string; occurredAt?: string })
              : null;
          const fromPayload =
            payload?.occurredAt !== undefined ? new Date(payload.occurredAt) : null;
          const occurredAt =
            fromPayload !== null && !Number.isNaN(fromPayload.getTime())
              ? fromPayload
              : payment.updatedAt ?? payment.createdAt;
          return {
            paymentId: payment.id,
            registrationId: payment.registrationId,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            reasonCode: typeof payload?.reasonCode === "string" ? payload.reasonCode : null,
            occurredAt,
          };
        }),
      };
    });
  }

  async listOutstandingBalanceCandidates(
    tenantId: string
  ): Promise<ListOutstandingBalanceCandidatesResult> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.operatorRegistration.findMany({
        where: { tenantId },
        select: { id: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return {
        candidates: rows.map((row) => ({
          registrationId: row.id,
          occurredAt: row.createdAt,
        })),
      };
    });
  }

  async updateReceiptReview(
    tenantId: string,
    receiptId: string,
    input: UpdateReceiptReviewInput
  ): Promise<FinanceReceiptRow> {
    return withTenantRls(tenantId, async (tx) => {
      const touched = await tx.paymentReceipt.updateMany({
        where: { id: receiptId, tenantId },
        data: {
          status: input.status,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote ?? null,
          ...(input.ledgerJournalId !== undefined
            ? { ledgerJournalId: input.ledgerJournalId }
            : {}),
        },
      });
      if (touched.count !== 1) {
        throw new Error("FINANCE_RECEIPT_NOT_FOUND");
      }
      const row = await tx.paymentReceipt.findFirst({
        where: { id: receiptId, tenantId },
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
      if (row === null) {
        throw new Error("FINANCE_RECEIPT_NOT_FOUND");
      }
      return toFinanceReceiptRow(row);
    });
  }

  async markPaymentPaid(
    tenantId: string,
    paymentId: string,
    ledgerJournalId: string
  ): Promise<FinancePaymentRow> {
    return withTenantRls(tenantId, async (tx) => {
      const touched = await tx.payment.updateMany({
        where: { id: paymentId, tenantId },
        data: {
          status: "Paid",
          paidAt: new Date(),
          ledgerJournalId,
        },
      });
      if (touched.count !== 1) {
        throw new Error("FINANCE_PAYMENT_NOT_FOUND");
      }
      const row = await tx.payment.findFirst({
        where: { id: paymentId, tenantId },
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
      if (row === null) {
        throw new Error("FINANCE_PAYMENT_NOT_FOUND");
      }
      return toFinancePaymentRow(row);
    });
  }

  /** Compensating write when booking payment projection fails after markPaymentPaid. */
  async revertPaymentToPending(tenantId: string, paymentId: string): Promise<FinancePaymentRow> {
    return withTenantRls(tenantId, async (tx) => {
      const touched = await tx.payment.updateMany({
        where: { id: paymentId, tenantId },
        data: {
          status: "Pending",
          paidAt: null,
          ledgerJournalId: null,
        },
      });
      if (touched.count !== 1) {
        throw new Error("FINANCE_PAYMENT_NOT_FOUND");
      }
      const row = await tx.payment.findFirst({
        where: { id: paymentId, tenantId },
        select: PAYMENT_ROW_SELECT,
      });
      if (row === null) {
        throw new Error("FINANCE_PAYMENT_NOT_FOUND");
      }
      return toFinancePaymentRow(row);
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

      let bookingPaymentStatus: ApproveManualReceiptAtomicResult["bookingPaymentStatus"];
      try {
        const facts = await loadRegistrationInvoiceFacts(tx, input.tenantId, input.registrationId);
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
        bookingPaymentStatus = await this.bookingPayments.raisePaidInTx(tx as FinanceTransactionPort, {
          tenantId: input.tenantId,
          registrationId: input.registrationId,
          paymentStatus,
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

      // Prisma path is durable: Paid without a non-empty capture is forbidden.
      const capture = input.ledgerCapture;
      if (capture === undefined || capture.lines.length === 0) {
        throw new Error("FINANCE_LEDGER_CAPTURE_EMPTY");
      }

      // Path A XOR Path B: block only when TourCreated already credited the wallet.
      // Multiple payment captures for partial collection are allowed (PR20-D).
      await advisoryLockRegistrationWalletCredit(tx, input.tenantId, input.registrationId);
      if (await registrationHasTourCreatedWalletCredit(tx, input.tenantId, input.registrationId)) {
        throw new Error("FINANCE_DUPLICATE_OBLIGATION_CREDIT");
      }

      const inserted = await enqueueFinanceLedgerCaptureOutbox({
        outboxWriter: createTxScopedOutboxWriter(tx),
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        capture,
      });
      if (!inserted) {
        throw new Error("FINANCE_APPROVE_CONFLICT");
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

  /**
   * PR23-A.2 — Pending → Cancelled (Manual). No ledger / booking writes.
   * Conditional Pending update races safely with approveManualReceiptAtomic.
   */
  async cancelPendingManualPaymentAtomic(
    input: CancelPendingManualPaymentAtomicInput
  ): Promise<CancelPendingManualPaymentAtomicResult> {
    const domainEventId = `payment-cancelled:${input.paymentId}`.slice(0, 128);
    return withTenantRls(input.tenantId, async (tx) => {
      const row = await tx.payment.findFirst({
        where: { id: input.paymentId, tenantId: input.tenantId },
        select: PAYMENT_ROW_SELECT,
      });
      if (row === null) {
        throw new Error("PAYMENT_NOT_FOUND");
      }
      if (row.method !== "Manual") {
        throw new Error("PAYMENT_CANCEL_ONLY_MANUAL");
      }

      const buildAudit = (
        payment: typeof row
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

      if (row.status === "Cancelled") {
        const prior = await tx.outboxEvent.findFirst({
          where: {
            tenantId: input.tenantId,
            domainEventId,
            eventType: "finance.payment.cancelled",
          },
          select: { payload: true },
        });
        const auditPayload =
          prior !== null &&
          typeof prior.payload === "object" &&
          prior.payload !== null
            ? (prior.payload as CancelPendingManualPaymentAtomicResult["auditPayload"])
            : buildAudit(row);
        return {
          payment: toFinancePaymentRow(row),
          replay: true,
          domainEventId,
          auditPayload,
        };
      }

      if (row.status !== "Pending") {
        throw new Error("PAYMENT_NOT_CANCELLABLE");
      }

      const pendingReceiptCount = await tx.paymentReceipt.count({
        where: {
          tenantId: input.tenantId,
          paymentId: input.paymentId,
          status: "Pending",
        },
      });
      if (pendingReceiptCount > 0) {
        throw new Error("PAYMENT_HAS_PENDING_RECEIPT");
      }

      const updatedCount = await tx.payment.updateMany({
        where: {
          id: input.paymentId,
          tenantId: input.tenantId,
          status: "Pending",
          method: "Manual",
        },
        data: {
          status: "Cancelled",
        },
      });
      if (updatedCount.count !== 1) {
        const latest = await tx.payment.findFirst({
          where: { id: input.paymentId, tenantId: input.tenantId },
          select: PAYMENT_ROW_SELECT,
        });
        if (latest !== null && latest.status === "Cancelled") {
          return {
            payment: toFinancePaymentRow(latest),
            replay: true,
            domainEventId,
            auditPayload: buildAudit(latest),
          };
        }
        throw new Error("PAYMENT_NOT_CANCELLABLE");
      }

      const cancelled = await tx.payment.findFirstOrThrow({
        where: { id: input.paymentId, tenantId: input.tenantId },
        select: PAYMENT_ROW_SELECT,
      });
      const auditPayload = buildAudit(cancelled);

      await enqueueOutboxEvent(tx, {
        tenantId: input.tenantId,
        aggregateType: "payment",
        aggregateId: input.paymentId,
        eventType: "finance.payment.cancelled",
        domainEventId,
        payload: auditPayload,
      });

      return {
        payment: toFinancePaymentRow(cancelled),
        replay: false,
        domainEventId,
        auditPayload,
      };
    });
  }

  async listPrepayments(
    tenantId: string,
    limit: number
  ): Promise<readonly FinancePrepaymentListRow[]> {
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
  async recordPrepaymentAtomic(
    input: RecordPrepaymentAtomicInput
  ): Promise<RecordPrepaymentAtomicResult> {
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

        if (input.lines.length === 0) {
          throw new Error("FINANCE_LEDGER_CAPTURE_EMPTY");
        }

        const ledgerInserted = await enqueueFinanceLedgerCaptureOutbox({
          outboxWriter: createTxScopedOutboxWriter(tx),
          tenantId: input.tenantId,
          registrationId: input.registrationId,
          capture: {
            journalId: input.journalId,
            domainEventId: input.ledgerDomainEventId,
            lines: input.lines,
          },
        });
        if (!ledgerInserted) {
          throw new Error("FINANCE_PREPAYMENT_CONFLICT");
        }

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
  ): Promise<readonly PrepaymentBookingSyncDegradedRow[]> {
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
      const out: PrepaymentBookingSyncDegradedRow[] = [];
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
  ): Promise<RegistrationInvoiceFacts> {
    return withTenantRls(tenantId, async (tx) => {
      return loadRegistrationInvoiceFacts(tx, tenantId, registrationId);
    });
  }

  async createRefund(input: CreateRefundInput): Promise<FinanceRefundRow> {
    return withTenantRls(input.tenantId, async (tx) => {
      if (input.creationIdempotencyKey) {
        const existing = await tx.financeRefund.findFirst({
          where: {
            tenantId: input.tenantId,
            creationIdempotencyKey: input.creationIdempotencyKey,
          },
        });
        if (existing !== null) {
          return mapFinanceRefundRow(existing);
        }
      }
      const created = await tx.financeRefund.create({
        data: {
          tenantId: input.tenantId,
          registrationId: input.registrationId,
          paymentId: input.paymentId,
          sourceKind: input.sourceKind,
          amountMinor: input.amountMinor,
          currency: input.currency.toUpperCase(),
          reasonCode: input.reasonCode,
          reasonNote: input.reasonNote,
          status: "Requested",
          requestedAt: new Date(input.requestedAtIso),
          requestedByUserId: input.requestedByUserId,
          evidenceFileKey: input.evidenceFileKey ?? null,
          evidenceNote: input.evidenceNote ?? null,
          creationIdempotencyKey: input.creationIdempotencyKey ?? null,
        },
      });
      return mapFinanceRefundRow(created);
    });
  }

  async findRefundById(tenantId: string, refundId: string): Promise<FinanceRefundRow | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.financeRefund.findFirst({
        where: { id: refundId, tenantId },
      });
      return row === null ? null : mapFinanceRefundRow(row);
    });
  }

  async findRefundByCreationIdempotencyKey(
    tenantId: string,
    creationIdempotencyKey: string
  ): Promise<FinanceRefundRow | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.financeRefund.findFirst({
        where: { tenantId, creationIdempotencyKey },
      });
      return row === null ? null : mapFinanceRefundRow(row);
    });
  }

  async listRefundsForRegistration(
    tenantId: string,
    registrationId: string
  ): Promise<readonly FinanceRefundRow[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.financeRefund.findMany({
        where: { tenantId, registrationId },
        orderBy: { requestedAt: "asc" },
      });
      return rows.map(mapFinanceRefundRow);
    });
  }

  async listRefundsPage(query: ListRefundsPageQuery): Promise<ListRefundsPageResult> {
    const limit = Math.max(1, Math.floor(query.limit));
    return withTenantRls(query.tenantId, async (tx) => {
      const where: Prisma.FinanceRefundWhereInput = {
        tenantId: query.tenantId,
        ...(query.registrationId !== undefined
          ? { registrationId: query.registrationId }
          : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
      };

      const cursorRaw = query.cursor;
      if (cursorRaw !== undefined && cursorRaw !== null) {
        const cursorAt = new Date(cursorRaw.requestedAt);
        if (!Number.isNaN(cursorAt.getTime()) && cursorRaw.id.length > 0) {
          where.AND = [
            {
              OR: [
                { requestedAt: { lt: cursorAt } },
                {
                  AND: [{ requestedAt: cursorAt }, { id: { lt: cursorRaw.id } }],
                },
              ],
            },
          ];
        }
      }

      const rows = await tx.financeRefund.findMany({
        where,
        orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      return { rows: page.map(mapFinanceRefundRow), hasMore };
    });
  }

  async sumCompletedRefundsMinor(query: SumCompletedRefundsQuery): Promise<string> {
    return withTenantRls(query.tenantId, async (tx) => {
      const rows = await tx.financeRefund.findMany({
        where: {
          tenantId: query.tenantId,
          registrationId: query.registrationId,
          status: "Completed",
          ...(query.paymentId !== undefined ? { paymentId: query.paymentId } : {}),
          ...(query.sourceKind !== undefined ? { sourceKind: query.sourceKind } : {}),
          ...(query.excludeRefundId !== undefined
            ? { id: { not: query.excludeRefundId } }
            : {}),
        },
        select: { amountMinor: true },
      });
      let sum = BigInt(0);
      for (const row of rows) {
        sum += BigInt(row.amountMinor.replace(/\D/g, "") || "0");
      }
      return sum.toString();
    });
  }

  async transitionRefundStatus(
    input: TransitionRefundStatusInput
  ): Promise<{ readonly refund: FinanceRefundRow; readonly replay: boolean }> {
    return withTenantRls(input.tenantId, async (tx) => {
      const existing = await tx.financeRefund.findFirst({
        where: { id: input.refundId, tenantId: input.tenantId },
      });
      if (existing === null) {
        throw new Error("REFUND_NOT_FOUND");
      }
      if (existing.status === input.toStatus) {
        if (input.toStatus === "Completed" || input.toStatus === "Approved") {
          return { refund: mapFinanceRefundRow(existing), replay: true };
        }
        throw new Error("REFUND_NOT_TRANSITIONABLE");
      }
      if (!(input.fromStatuses as readonly string[]).includes(existing.status)) {
        throw new Error("REFUND_NOT_TRANSITIONABLE");
      }
      const occurredAt = new Date(input.occurredAtIso);
      const updated = await tx.financeRefund.update({
        where: { id: existing.id },
        data: {
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
        },
      });
      return { refund: mapFinanceRefundRow(updated), replay: false };
    });
  }
}

function mapFinanceRefundRow(row: {
  readonly id: string;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly paymentId: string | null;
  readonly sourceKind: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly reasonCode: string;
  readonly reasonNote: string | null;
  readonly status: string;
  readonly requestedAt: Date;
  readonly requestedByUserId: string;
  readonly approvedAt: Date | null;
  readonly approvedByUserId: string | null;
  readonly rejectedAt: Date | null;
  readonly rejectedByUserId: string | null;
  readonly rejectNote: string | null;
  readonly cancelledAt: Date | null;
  readonly cancelledByUserId: string | null;
  readonly completedAt: Date | null;
  readonly completedByUserId: string | null;
  readonly completionNote: string | null;
  readonly evidenceFileKey: string | null;
  readonly evidenceNote: string | null;
  readonly creationIdempotencyKey: string | null;
}): FinanceRefundRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    registrationId: row.registrationId,
    paymentId: row.paymentId,
    sourceKind: row.sourceKind as RefundSourceKind,
    amountMinor: row.amountMinor,
    currency: row.currency,
    reasonCode: row.reasonCode as RefundReasonCode,
    reasonNote: row.reasonNote,
    status: row.status as RefundStatus,
    requestedAt: row.requestedAt,
    requestedByUserId: row.requestedByUserId,
    approvedAt: row.approvedAt,
    approvedByUserId: row.approvedByUserId,
    rejectedAt: row.rejectedAt,
    rejectedByUserId: row.rejectedByUserId,
    rejectNote: row.rejectNote,
    cancelledAt: row.cancelledAt,
    cancelledByUserId: row.cancelledByUserId,
    completedAt: row.completedAt,
    completedByUserId: row.completedByUserId,
    completionNote: row.completionNote,
    evidenceFileKey: row.evidenceFileKey,
    evidenceNote: row.evidenceNote,
    creationIdempotencyKey: row.creationIdempotencyKey,
  };
}
