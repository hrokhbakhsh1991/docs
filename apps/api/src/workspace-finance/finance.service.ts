import { createHash } from "node:crypto";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import {
  bookingWalletId,
  emitFinanceLedgerDoubleEntryAppliedOutbox,
  LEDGER_ACCOUNTS,
  postDoubleEntryJournal,
} from "@app-tour/workspace-denali";

import {
  assertFinanceOperatorAccess,
  assertFinanceReceiptSubmitAccess,
  assertFinanceWorkspaceGate,
} from "./assert-finance-access";
import { compileRegistrationInvoice } from "./compile-invoice-balances";
import type {
  CreateManualPaymentBody,
  GenerateScheduleBody,
  RecordPrepaymentBody,
  ReviewReceiptBody,
  SubmitReceiptBody,
} from "@app-tour/workspace-denali/http";
import type { FinanceLedgerOutboxRow, FinanceRepository, FinanceSummaryRow } from "./finance.repository";
import { createFinanceRepository } from "./finance.repository";
import {
  buildPaymentScheduleItems,
  getSchedule,
  listAllSchedules,
  putSchedule,
  type PrepaymentRecord,
} from "./finance-schedule-store";
import { createPrismaWorkspaceOutboxWriter } from "./prisma-workspace-outbox-writer";

function assertManualPaymentDebtAllowed(statuses: readonly string[]): void {
  if (statuses.some((status) => status === "Paid")) {
    throw new Error(
      "ZOD_VALIDATION_FAILED: registration already has a successful payment; additional manual debt is not allowed"
    );
  }
}

function deterministicUuidFromSeed(seed: string): string {
  const hash = createHash("sha256").update(seed, "utf8").digest();
  const buf = Buffer.alloc(16);
  hash.copy(buf, 0, 0, 16);
  buf[6] = (buf[6]! & 0x0f) | 0x40;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function stablePaymentCaptureLedgerIdentifiers(paymentId: string): {
  journalId: string;
  debitLineId: string;
  creditLineId: string;
} {
  const id = paymentId.trim();
  return {
    journalId: deterministicUuidFromSeed(`payment-ledger:journal:${id}`),
    debitLineId: deterministicUuidFromSeed(`payment-ledger:debit:${id}`),
    creditLineId: deterministicUuidFromSeed(`payment-ledger:credit:${id}`),
  };
}

function mapLedgerEventRow(row: FinanceLedgerOutboxRow): Record<string, unknown> {
  const payload =
    row.payload !== null && typeof row.payload === "object"
      ? (row.payload as Record<string, unknown>)
      : {};
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const registrationId =
    typeof payload.registrationId === "string" ? payload.registrationId : null;
  const journalId =
    (typeof payload.journalId === "string" && payload.journalId.trim()) || row.aggregateId;
  return {
    outboxEventId: row.id,
    eventType: row.eventType,
    journalId,
    registrationId,
    domainEventId: row.domainEventId,
    lineCount: lines.length,
    createdAt: row.createdAt.toISOString(),
    lines,
  };
}

export class FinanceService {
  constructor(private readonly repository: FinanceRepository) {}

  private async gate(auth: TenantAuthContext): Promise<void> {
    await assertFinanceWorkspaceGate(auth.tenantId);
  }

  private static emptySummary(): FinanceSummaryRow {
    return {
      pendingManualPayments: 0,
      pendingReceiptReviews: 0,
      paidPayments: 0,
      failedPayments: 0,
    };
  }

  async getSummary(auth: TenantAuthContext) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    if (!process.env.DATABASE_URL?.trim()) {
      return FinanceService.emptySummary();
    }
    return this.repository.getSummary(auth.tenantId);
  }

  async listOpenPayments(auth: TenantAuthContext, limit: number) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const rows = await this.repository.listOpenPayments(auth.tenantId, limit);
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listPayments(auth: TenantAuthContext, limit: number) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const rows = await this.repository.listPayments(auth.tenantId, limit);
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
    }));
  }

  async listLedgerEvents(auth: TenantAuthContext, limit: number) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const rows = await this.repository.listLedgerEvents(auth.tenantId, limit);
    return rows.map(mapLedgerEventRow);
  }

  async listPendingReceipts(auth: TenantAuthContext, limit: number) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const rows = await this.repository.listPendingReceipts(auth.tenantId, limit);
    return rows.map((row) => ({
      id: row.id,
      paymentId: row.paymentId,
      fileKey: row.fileKey,
      status: row.status,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      payment: row.payment
        ? {
            ...row.payment,
            createdAt: row.payment.createdAt.toISOString(),
            paidAt: row.payment.paidAt?.toISOString() ?? null,
          }
        : null,
    }));
  }

  async createManualPayment(auth: TenantAuthContext, body: CreateManualPaymentBody) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const statuses = await this.repository.findPaymentStatusesByRegistration(
      auth.tenantId,
      body.registrationId
    );
    assertManualPaymentDebtAllowed(statuses);
    const payment = await this.repository.createManualPayment({
      tenantId: auth.tenantId,
      registrationId: body.registrationId,
      amount: body.amount,
      currency: body.currency,
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    return {
      ...payment,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
    };
  }

  async submitReceipt(auth: TenantAuthContext, body: SubmitReceiptBody) {
    await this.gate(auth);
    assertFinanceReceiptSubmitAccess(auth);
    const payment = await this.repository.findPaymentById(auth.tenantId, body.paymentId);
    if (payment === null) {
      throw new Error("FINANCE_PAYMENT_NOT_FOUND");
    }
    if (payment.method !== "Manual") {
      throw new Error("ZOD_VALIDATION_FAILED: receipts can only be submitted for manual payments");
    }
    if (payment.status !== "Pending") {
      throw new Error(
        `ZOD_VALIDATION_FAILED: cannot submit receipt for payment with status ${payment.status}`
      );
    }
    const pendingCount = await this.repository.countPendingReceiptsForPayment(
      auth.tenantId,
      payment.id
    );
    if (pendingCount > 0) {
      throw new Error("ZOD_VALIDATION_FAILED: payment already has a pending receipt");
    }
    const receipt = await this.repository.createReceipt({
      tenantId: auth.tenantId,
      paymentId: payment.id,
      fileKey: body.fileKey,
      note: body.note,
    });
    return {
      id: receipt.id,
      paymentId: receipt.paymentId,
      fileKey: receipt.fileKey,
      status: receipt.status,
      note: receipt.note,
      createdAt: receipt.createdAt.toISOString(),
    };
  }

  async reviewReceipt(auth: TenantAuthContext, receiptId: string, body: ReviewReceiptBody) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const receipt = await this.repository.findReceiptById(auth.tenantId, receiptId);
    if (receipt === null) {
      throw new Error("FINANCE_RECEIPT_NOT_FOUND");
    }
    if (receipt.status !== "Pending") {
      throw new Error(`ZOD_VALIDATION_FAILED: receipt already ${receipt.status}`);
    }
    const payment = receipt.payment;
    if (payment === null) {
      throw new Error("FINANCE_PAYMENT_NOT_FOUND");
    }
    if (payment.status !== "Pending") {
      throw new Error(
        `ZOD_VALIDATION_FAILED: cannot review receipt for payment with status ${payment.status}`
      );
    }

    if (body.decision === "reject") {
      const updated = await this.repository.updateReceiptReview(auth.tenantId, receiptId, {
        status: "Rejected",
        reviewedByUserId: auth.userId,
        reviewNote: body.reviewNote,
      });
      return {
        id: updated.id,
        status: updated.status,
        reviewNote: updated.reviewNote,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      };
    }

    const stableIds = stablePaymentCaptureLedgerIdentifiers(payment.id);
    const paidAtIso = new Date().toISOString();
    const { journalId, lines } = postDoubleEntryJournal({
      tenantId: auth.tenantId,
      debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
      creditAccount: bookingWalletId(payment.registrationId),
      amount_minor: payment.amount,
      currency: payment.currency,
      correlationId: `payment:${payment.id}:capture`,
      idempotencyKey: `payment:${payment.id}:capture-anchor`,
      stableJournalAndLineIds: stableIds,
      journalLinesCreatedAtIso: paidAtIso,
      metadata: {
        kind: "payment_capture_at_paid",
        source: "manual_receipt_approve",
        paymentId: payment.id,
        registrationId: payment.registrationId,
      },
    });

    const outboxWriter = createPrismaWorkspaceOutboxWriter();
    await emitFinanceLedgerDoubleEntryAppliedOutbox({
      outboxWriter,
      tenantId: auth.tenantId,
      registrationId: payment.registrationId,
      lines,
      domainEventIdOverride: `payment:${payment.id}:ledger-capture-anchor`,
    });

    await this.repository.markPaymentPaid(auth.tenantId, payment.id, journalId);
    const updated = await this.repository.updateReceiptReview(auth.tenantId, receiptId, {
      status: "Approved",
      reviewedByUserId: auth.userId,
      reviewNote: body.reviewNote,
      ledgerJournalId: journalId,
    });

    return {
      id: updated.id,
      status: updated.status,
      reviewNote: updated.reviewNote,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      ledgerJournalId: journalId,
    };
  }

  async getReceiptUrl(auth: TenantAuthContext, receiptId: string) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const receipt = await this.repository.findReceiptById(auth.tenantId, receiptId);
    if (receipt === null) {
      throw new Error("FINANCE_RECEIPT_NOT_FOUND");
    }
    return {
      receiptId: receipt.id,
      fileKey: receipt.fileKey,
      url: `/internal/finance/receipts/${receipt.id}/file?key=${encodeURIComponent(receipt.fileKey)}`,
    };
  }

  async listPrepayments(auth: TenantAuthContext, limit: number): Promise<readonly PrepaymentRecord[]> {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    return this.repository.listPrepayments(auth.tenantId, limit);
  }

  async recordPrepayment(auth: TenantAuthContext, body: RecordPrepaymentBody) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const method = body.method.trim().length > 0 ? body.method.trim() : "Manual";
    const stableIds = stablePaymentCaptureLedgerIdentifiers(
      `prepay:${body.registrationId}:${body.amountMinor}`
    );
    const recordedAtIso = new Date().toISOString();
    const { journalId, lines } = postDoubleEntryJournal({
      tenantId: auth.tenantId,
      debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
      creditAccount: bookingWalletId(body.registrationId),
      amount_minor: body.amountMinor,
      currency: body.currency,
      correlationId: `prepayment:${body.registrationId}:${body.amountMinor}`,
      idempotencyKey: `prepayment:${body.registrationId}:${body.amountMinor}`,
      stableJournalAndLineIds: stableIds,
      journalLinesCreatedAtIso: recordedAtIso,
      metadata: {
        kind: "registration_prepayment_received",
        registrationId: body.registrationId,
        method,
      },
    });

    const outboxWriter = createPrismaWorkspaceOutboxWriter();
    await emitFinanceLedgerDoubleEntryAppliedOutbox({
      outboxWriter,
      tenantId: auth.tenantId,
      registrationId: body.registrationId,
      lines,
      domainEventIdOverride: `prepayment:${body.registrationId}:${body.amountMinor}:ledger`,
    });

    return this.repository.recordPrepayment({
      tenantId: auth.tenantId,
      registrationId: body.registrationId,
      amountMinor: body.amountMinor,
      currency: body.currency.toUpperCase(),
      method,
      note: body.note ?? null,
      journalId,
      recordedAt: recordedAtIso,
    });
  }

  async listPaymentSchedules(auth: TenantAuthContext) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    return listAllSchedules(auth.tenantId);
  }

  async getPaymentSchedule(auth: TenantAuthContext, registrationId: string) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    return getSchedule(auth.tenantId, registrationId);
  }

  async generatePaymentSchedule(auth: TenantAuthContext, body: GenerateScheduleBody) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const items = buildPaymentScheduleItems({
      registrationId: body.registrationId,
      template: body.template,
    });
    putSchedule(auth.tenantId, body.registrationId, items);
    return { registrationId: body.registrationId, items };
  }

  async getRegistrationInvoice(auth: TenantAuthContext, registrationId: string) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const normalizedRegistrationId = registrationId.trim();
    const facts = await this.repository.getRegistrationInvoiceFacts(
      auth.tenantId,
      normalizedRegistrationId
    );
    const scheduleItems = getSchedule(auth.tenantId, normalizedRegistrationId);
    return compileRegistrationInvoice({
      registrationId: normalizedRegistrationId,
      currency: facts.currency,
      prepaymentMinor: facts.prepaymentMinor,
      paidPaymentsMinor: facts.paidPaymentsMinor,
      paymentAmountsMinor: facts.paymentAmountsMinor,
      scheduleAmountsMinor: scheduleItems.map((item) => item.amountMinor),
    });
  }
}

export function createFinanceService(
  repository: FinanceRepository = createFinanceRepository()
): FinanceService {
  return new FinanceService(repository);
}
