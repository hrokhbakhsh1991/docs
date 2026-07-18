import { createHash } from "node:crypto";

import { metricsRegistry } from "../observability/metrics";
import { resolveStorageDriver } from "../storage/production-storage-driver-assert";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type {
  CreateManualPaymentBody,
  GenerateScheduleBody,
  RecordPrepaymentBody,
  ReviewReceiptBody,
  SubmitReceiptBody,
} from "@app-tour/finance-http-contracts";

import {
  assertFinanceOperatorAccess,
  assertFinanceReceiptSubmitAccess,
  assertFinanceWorkspaceGate,
} from "./assert-finance-access";
import { compileRegistrationInvoice } from "./compile-invoice-balances";
import type { FinanceLedgerOutboxRow, FinanceSummaryRow } from "./finance.repository";
import {
  createFinanceRepository,
  type FinanceRepositoryPort,
} from "./finance-repository.factory";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter";
import type { IBookingPaymentPort } from "./ports/booking-payment.port";
import type { FinanceLedgerPolicyPort } from "./ports/finance-ledger-policy.port";
import type { FinanceReceiptDefaultsPort } from "./ports/finance-receipt-defaults.port";
import {
  buildPaymentScheduleItems,
  getSchedule,
  listAllSchedules,
  putSchedule,
} from "./finance-schedule-store";
import {
  attachFinanceRegistrationContext,
  filterRowsByRegistrationId,
  loadFinanceRegistrationContextMap,
} from "./finance-registration-context";

function hashClientIdempotencyKey(idempotencyKey: string): string {
  return createHash("sha256").update(idempotencyKey, "utf8").digest("hex").slice(0, 40);
}

/** Full SHA-256 hex — durable business keys for manual payment create / receipt submit. */
export function hashFinanceHttpIdempotencyKey(idempotencyKey: string): string {
  return createHash("sha256").update(idempotencyKey, "utf8").digest("hex");
}

/** Stable outbox/business identity — never uses timestamps or amount-only keys. */
export function buildPrepaymentDomainEventIds(
  registrationId: string,
  idempotencyKey: string
): {
  readonly keyHash: string;
  readonly prepaymentDomainEventId: string;
  readonly ledgerDomainEventId: string;
  readonly journalSeed: string;
} {
  const keyHash = hashClientIdempotencyKey(idempotencyKey);
  const prepaymentDomainEventId = `prepayment:${registrationId}:${keyHash}`;
  return {
    keyHash,
    prepaymentDomainEventId,
    ledgerDomainEventId: `${prepaymentDomainEventId}:ledger`,
    journalSeed: `prepay:${registrationId}:${keyHash}`,
  };
}

function assertManualPaymentDebtAllowed(statuses: readonly string[]): void {
  if (statuses.some((status) => status === "Paid")) {
    throw new Error(
      "ZOD_VALIDATION_FAILED: registration already has a successful payment; additional manual debt is not allowed"
    );
  }
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
  constructor(
    private readonly ledgerPolicy: FinanceLedgerPolicyPort,
    private readonly repository: FinanceRepositoryPort = createFinanceRepository(),
    private readonly bookingPayments: IBookingPaymentPort = new BookingPaymentAdapter(),
    private readonly receiptDefaults: FinanceReceiptDefaultsPort
  ) {}

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

  async listOpenPayments(auth: TenantAuthContext, limit: number, registrationId?: string) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const rows = filterRowsByRegistrationId(
      await this.repository.listOpenPayments(auth.tenantId, limit),
      registrationId
    );
    const contexts = await loadFinanceRegistrationContextMap(
      auth.tenantId,
      rows.map((row) => row.registrationId)
    );
    return rows.map((row) =>
      attachFinanceRegistrationContext(
        {
          ...row,
          createdAt: row.createdAt.toISOString(),
        },
        contexts
      )
    );
  }

  async listPayments(auth: TenantAuthContext, limit: number, registrationId?: string) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const rows = filterRowsByRegistrationId(
      await this.repository.listPayments(auth.tenantId, limit),
      registrationId
    );
    const contexts = await loadFinanceRegistrationContextMap(
      auth.tenantId,
      rows.map((row) => row.registrationId)
    );
    return rows.map((row) =>
      attachFinanceRegistrationContext(
        {
          ...row,
          createdAt: row.createdAt.toISOString(),
          paidAt: row.paidAt?.toISOString() ?? null,
        },
        contexts
      )
    );
  }

  async listLedgerEvents(auth: TenantAuthContext, limit: number, registrationId?: string) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const mapped = (await this.repository.listLedgerEvents(auth.tenantId, limit)).map(
      mapLedgerEventRow
    );
    const withRegistration = mapped.filter(
      (row): row is typeof row & { registrationId: string } =>
        typeof row.registrationId === "string" && row.registrationId.length > 0
    );
    const filtered =
      registrationId === undefined
        ? mapped
        : mapped.filter((row) => row.registrationId === registrationId);
    const contexts = await loadFinanceRegistrationContextMap(
      auth.tenantId,
      withRegistration.map((row) => row.registrationId)
    );
    return filtered.map((row) => {
      const registrationIdValue =
        typeof row.registrationId === "string" ? row.registrationId : "";
      if (registrationIdValue.length === 0) {
        return { ...row, registrationContext: null };
      }
      return attachFinanceRegistrationContext(
        { ...row, registrationId: registrationIdValue },
        contexts
      );
    });
  }

  async listPendingReceipts(auth: TenantAuthContext, limit: number, registrationId?: string) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const rows = await this.repository.listPendingReceipts(auth.tenantId, limit);
    const mapped = rows.map((row) => ({
      id: row.id,
      paymentId: row.paymentId,
      fileKey: row.fileKey,
      status: row.status,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      registrationId: row.payment?.registrationId ?? "",
      payment: row.payment
        ? {
            ...row.payment,
            createdAt: row.payment.createdAt.toISOString(),
            paidAt: row.payment.paidAt?.toISOString() ?? null,
          }
        : null,
    }));
    const filtered = filterRowsByRegistrationId(
      mapped.filter((row) => row.registrationId.length > 0),
      registrationId
    );
    // Keep receipts without payment when no registration filter (edge); when filtering, only matched.
    const list =
      registrationId === undefined
        ? mapped
        : filtered;
    const contexts = await loadFinanceRegistrationContextMap(
      auth.tenantId,
      list.map((row) => row.registrationId).filter((id) => id.length > 0)
    );
    return list.map((row) => {
      const { registrationId: _drop, ...rest } = row;
      if (row.registrationId.length === 0) {
        return { ...rest, registrationContext: null };
      }
      return attachFinanceRegistrationContext(
        { ...rest, registrationId: row.registrationId },
        contexts
      );
    });
  }

  async createManualPayment(
    auth: TenantAuthContext,
    body: CreateManualPaymentBody,
    idempotencyKey: string
  ) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const trimmedKey = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
    if (trimmedKey.length === 0) {
      throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    }
    const creationIdempotencyKey = hashFinanceHttpIdempotencyKey(trimmedKey);
    // Repository find-before-create replays existing keyed payments before insert.
    // Debt gate only applies to fresh inserts (no prior row for this key).
    const existing = await this.repository.findPaymentByCreationIdempotencyKey(
      auth.tenantId,
      creationIdempotencyKey
    );
    if (existing !== null) {
      if (
        existing.registrationId !== body.registrationId ||
        existing.amount !== body.amount ||
        existing.currency !== body.currency.toUpperCase()
      ) {
        throw new Error("FINANCE_PAYMENT_IDEMPOTENCY_CONFLICT");
      }
      return {
        ...existing,
        createdAt: existing.createdAt.toISOString(),
        paidAt: existing.paidAt?.toISOString() ?? null,
      };
    }
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
      creationIdempotencyKey,
    });
    return {
      ...payment,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
    };
  }

  async submitReceipt(
    auth: TenantAuthContext,
    body: SubmitReceiptBody,
    idempotencyKey?: string
  ) {
    await this.gate(auth);
    assertFinanceReceiptSubmitAccess(auth);
    const trimmedKey = idempotencyKey?.trim() ?? "";
    const idempotencyKeyHash =
      trimmedKey.length > 0 ? hashFinanceHttpIdempotencyKey(trimmedKey) : undefined;
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
    const receipt = await this.repository.createReceipt({
      tenantId: auth.tenantId,
      paymentId: payment.id,
      fileKey: body.fileKey,
      note: body.note,
      ...(idempotencyKeyHash !== undefined ? { idempotencyKeyHash } : {}),
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

  async submitMemberReceiptForRegistration(
    auth: TenantAuthContext,
    input: { readonly registrationId: string; readonly fileKey: string; readonly note?: string }
  ) {
    const owns = await this.bookingPayments.memberOwnsRegistration({
      tenantId: auth.tenantId,
      registrationId: input.registrationId,
      userId: auth.userId,
    });
    if (!owns) {
      throw new Error("BOOKINGS_FORBIDDEN");
    }

    let payment = await this.repository.findFirstPendingManualPayment(
      auth.tenantId,
      input.registrationId
    );
    if (payment === null) {
      const statuses = await this.repository.findPaymentStatusesByRegistration(
        auth.tenantId,
        input.registrationId
      );
      assertManualPaymentDebtAllowed(statuses);
      const offlineDefaults = this.receiptDefaults.offlineReceiptPaymentDefaults();
      payment = await this.repository.createManualPayment({
        tenantId: auth.tenantId,
        registrationId: input.registrationId,
        amount: offlineDefaults.amountMinor,
        currency: offlineDefaults.currency,
        method: "Manual",
        provider: "manual",
        status: "Pending",
      });
    }

    return this.submitReceipt(auth, {
      paymentId: payment.id,
      fileKey: input.fileKey,
      ...(input.note !== undefined ? { note: input.note } : {}),
    });
  }

  async getMemberReceiptStatusForRegistration(
    auth: TenantAuthContext,
    registrationId: string
  ): Promise<{ readonly status: "none" | "pending" | "rejected" | "paid" }> {
    await this.gate(auth);
    assertFinanceReceiptSubmitAccess(auth);

    const owns = await this.bookingPayments.memberOwnsRegistration({
      tenantId: auth.tenantId,
      registrationId,
      userId: auth.userId,
    });
    if (!owns) {
      throw new Error("BOOKINGS_FORBIDDEN");
    }

    const paymentStatuses = await this.repository.findPaymentStatusesByRegistration(
      auth.tenantId,
      registrationId
    );
    if (paymentStatuses.some((status) => status === "Paid")) {
      return { status: "paid" };
    }

    const latest = await this.repository.findLatestReceiptForRegistration(
      auth.tenantId,
      registrationId
    );
    if (latest === null) {
      return { status: "none" };
    }
    if (latest.status === "Pending") {
      return { status: "pending" };
    }
    if (latest.status === "Rejected") {
      return { status: "rejected" };
    }
    if (latest.status === "Approved") {
      return { status: "paid" };
    }
    return { status: "none" };
  }

  async reviewReceipt(auth: TenantAuthContext, receiptId: string, body: ReviewReceiptBody) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const receipt = await this.repository.findReceiptById(auth.tenantId, receiptId);
    if (receipt === null) {
      throw new Error("FINANCE_RECEIPT_NOT_FOUND");
    }
    const payment = receipt.payment;
    if (payment === null) {
      throw new Error("FINANCE_PAYMENT_NOT_FOUND");
    }

    // Phase 4B H0.1 — approve retry-safe after idempotency reclaim (non-destructive replay).
    if (
      body.decision === "approve" &&
      receipt.status === "Approved" &&
      payment.status === "Paid"
    ) {
      return {
        id: receipt.id,
        status: receipt.status,
        reviewNote: receipt.reviewNote,
        reviewedAt: receipt.reviewedAt?.toISOString() ?? null,
        ledgerJournalId: receipt.ledgerJournalId ?? "",
        bookingPaymentStatus: await this.resolveApproveReplayBookingStatus(
          auth.tenantId,
          payment.registrationId
        ),
      };
    }

    if (receipt.status !== "Pending") {
      throw new Error(`ZOD_VALIDATION_FAILED: receipt already ${receipt.status}`);
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

    const paidAtIso = new Date().toISOString();
    const ledgerCapture = this.ledgerPolicy.buildPaymentCaptureJournal({
      tenantId: auth.tenantId,
      paymentId: payment.id,
      registrationId: payment.registrationId,
      amountMinor: payment.amount,
      currency: payment.currency,
      capturedAtIso: paidAtIso,
    });

    // Single RLS transaction (Prisma SoT): payment Paid → booking paid → receipt Approved → ledger.
    // Memory fake: fail-closed simulate via repository (not production-equivalent).
    try {
      return await this.repository.approveManualReceiptAtomic({
        tenantId: auth.tenantId,
        paymentId: payment.id,
        receiptId,
        registrationId: payment.registrationId,
        journalId: ledgerCapture.journalId,
        reviewedByUserId: auth.userId,
        ...(body.reviewNote !== undefined ? { reviewNote: body.reviewNote } : {}),
        ...(resolveStorageDriver() !== "memory" ? { ledgerCapture } : {}),
      });
    } catch (error: unknown) {
      // Concurrent approve: loser may lose Pending guards; if winner already committed, replay.
      if (!(error instanceof Error) || error.message !== "FINANCE_APPROVE_CONFLICT") {
        throw error;
      }
      const latest = await this.repository.findReceiptById(auth.tenantId, receiptId);
      if (
        latest !== null &&
        latest.status === "Approved" &&
        latest.payment !== null &&
        latest.payment.status === "Paid"
      ) {
        return {
          id: latest.id,
          status: latest.status,
          reviewNote: latest.reviewNote,
          reviewedAt: latest.reviewedAt?.toISOString() ?? null,
          ledgerJournalId: latest.ledgerJournalId ?? "",
          bookingPaymentStatus: await this.resolveApproveReplayBookingStatus(
            auth.tenantId,
            latest.payment.registrationId
          ),
        };
      }
      throw error;
    }
  }

  async getReceiptUrl(auth: TenantAuthContext, receiptId: string) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const receipt = await this.repository.findReceiptById(auth.tenantId, receiptId);
    if (receipt === null) {
      throw new Error("FINANCE_RECEIPT_NOT_FOUND");
    }
    const { getMemberReceiptProofSignedReadUrl } = await import("./receipt-proof-storage");
    try {
      const url = await getMemberReceiptProofSignedReadUrl({
        tenantId: auth.tenantId,
        storageKey: receipt.fileKey,
      });
      return {
        receiptId: receipt.id,
        fileKey: receipt.fileKey,
        url,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "MINIO_NOT_CONFIGURED" || message === "RECEIPT_PROOF_KEY_SCOPE_INVALID") {
        return {
          receiptId: receipt.id,
          fileKey: receipt.fileKey,
          url: `/internal/finance/receipts/${receipt.id}/file?key=${encodeURIComponent(receipt.fileKey)}`,
        };
      }
      throw error;
    }
  }

  async listPrepayments(auth: TenantAuthContext, limit: number, registrationId?: string) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const rows = filterRowsByRegistrationId(
      await this.repository.listPrepayments(auth.tenantId, limit),
      registrationId
    );
    const contexts = await loadFinanceRegistrationContextMap(
      auth.tenantId,
      rows.map((row) => row.registrationId)
    );
    return rows.map((row) => attachFinanceRegistrationContext(row, contexts));
  }

  async recordPrepayment(
    auth: TenantAuthContext,
    body: RecordPrepaymentBody,
    idempotencyKey: string
  ): Promise<Record<string, unknown>> {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const trimmedKey = idempotencyKey.trim();
    if (trimmedKey.length === 0) {
      throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    }
    const method = body.method.trim().length > 0 ? body.method.trim() : "Manual";
    const ids = buildPrepaymentDomainEventIds(body.registrationId, trimmedKey);
    const recordedAtIso = new Date().toISOString();
    const ledgerCapture = this.ledgerPolicy.buildPrepaymentJournal({
      tenantId: auth.tenantId,
      registrationId: body.registrationId,
      amountMinor: body.amountMinor,
      currency: body.currency,
      method,
      recordedAtIso,
      keyHash: ids.keyHash,
      prepaymentDomainEventId: ids.prepaymentDomainEventId,
      ledgerDomainEventId: ids.ledgerDomainEventId,
      journalSeed: ids.journalSeed,
    });

    const recorded = await this.repository.recordPrepaymentAtomic({
      tenantId: auth.tenantId,
      registrationId: body.registrationId,
      amountMinor: body.amountMinor,
      currency: body.currency.toUpperCase(),
      method,
      note: body.note ?? null,
      journalId: ledgerCapture.journalId,
      recordedAt: recordedAtIso,
      lines: ledgerCapture.lines,
      ledgerDomainEventId: ids.ledgerDomainEventId,
      prepaymentDomainEventId: ids.prepaymentDomainEventId,
      clientOperationKeyHash: ids.keyHash,
    });

    await this.trySyncBookingPaymentStatus(
      auth.tenantId,
      body.registrationId,
      "partial",
      ids.prepaymentDomainEventId
    );
    return {
      id: recorded.id,
      registrationId: recorded.registrationId,
      amountMinor: recorded.amountMinor,
      currency: recorded.currency,
      method: recorded.method,
      note: recorded.note,
      recordedAt: recorded.recordedAt,
    };
  }

  async listPrepaymentBookingSyncDegraded(auth: TenantAuthContext, limit: number) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    return this.repository.listOpenPrepaymentBookingSyncDegraded(auth.tenantId, limit);
  }

  async retryPrepaymentBookingSync(
    auth: TenantAuthContext,
    registrationId: string
  ): Promise<Record<string, unknown>> {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const paymentStatus = await this.raiseBookingPaymentStatus(
      auth.tenantId,
      registrationId,
      "partial"
    );
    await this.repository.markPrepaymentBookingSyncRecovered({
      tenantId: auth.tenantId,
      registrationId,
    });
    return { registrationId, paymentStatus, recovered: true };
  }

  async listPaymentSchedules(auth: TenantAuthContext, registrationId?: string) {
    await this.gate(auth);
    assertFinanceOperatorAccess(auth);
    const rows = filterRowsByRegistrationId(await listAllSchedules(auth.tenantId), registrationId);
    const contexts = await loadFinanceRegistrationContextMap(
      auth.tenantId,
      rows.map((row) => row.registrationId)
    );
    return rows.map((row) => attachFinanceRegistrationContext(row, contexts));
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
    await putSchedule(auth.tenantId, body.registrationId, items);
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
    const scheduleItems = await getSchedule(auth.tenantId, normalizedRegistrationId);
    return compileRegistrationInvoice({
      registrationId: normalizedRegistrationId,
      currency: facts.currency,
      prepaymentMinor: facts.prepaymentMinor,
      paidPaymentsMinor: facts.paidPaymentsMinor,
      paymentAmountsMinor: facts.paymentAmountsMinor,
      scheduleAmountsMinor: scheduleItems.map((item) => item.amountMinor),
    });
  }

  /**
   * Fail-closed booking projection for receipt approve / prepayment raise path.
   * Throws FINANCE_BOOKING_PAYMENT_SYNC_MISS | FINANCE_BOOKING_PAYMENT_SYNC_FAILED.
   */
  private async raiseBookingPaymentStatus(
    tenantId: string,
    registrationId: string,
    paymentStatus: "unpaid" | "partial" | "paid"
  ): Promise<"unpaid" | "partial" | "paid"> {
    try {
      const updated = await this.bookingPayments.syncStatus({
        tenantId,
        registrationId,
        paymentStatus,
      });
      if (updated === null) {
        console.warn(
          JSON.stringify({
            event: "finance.booking_payment_sync.miss",
            tenantId,
            registrationId,
            paymentStatus,
          })
        );
        throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_MISS");
      }
      return updated;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "FINANCE_BOOKING_PAYMENT_SYNC_MISS") {
        throw error;
      }
      console.warn(
        JSON.stringify({
          event: "finance.booking_payment_sync.failed",
          tenantId,
          registrationId,
          paymentStatus,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_FAILED");
    }
  }

  /**
   * Approve replay: prefer live booking projection; fall back to paid only when the
   * booking row is missing (Approved+Paid finance facts remain authoritative).
   */
  private async resolveApproveReplayBookingStatus(
    tenantId: string,
    registrationId: string
  ): Promise<"unpaid" | "partial" | "paid"> {
    const status = await this.bookingPayments.getPaymentStatus({
      tenantId,
      registrationId,
    });
    return status ?? "paid";
  }

  /** Soft-fail: missing booking must not roll back prepayment mutate. */
  private async trySyncBookingPaymentStatus(
    tenantId: string,
    registrationId: string,
    paymentStatus: "unpaid" | "partial" | "paid",
    prepaymentDomainEventId?: string
  ): Promise<void> {
    try {
      await this.raiseBookingPaymentStatus(tenantId, registrationId, paymentStatus);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        JSON.stringify({
          event: "finance.prepayment.booking_sync.degraded",
          tenantId,
          registrationId,
          paymentStatus,
          error: message,
          prepaymentDomainEventId: prepaymentDomainEventId ?? null,
        })
      );
      if (resolveStorageDriver() !== "memory") {
        await this.persistBookingSyncDegradedWithRetries({
          tenantId,
          registrationId,
          paymentStatus,
          error: message,
          prepaymentDomainEventId: prepaymentDomainEventId ?? "",
        });
      }
    }
  }

  /**
   * Operational notification only — runs after finance commit. Bounded retries;
   * permanent failure is observable and must not fail the HTTP prepay response.
   */
  private async persistBookingSyncDegradedWithRetries(input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly paymentStatus: string;
    readonly error: string;
    readonly prepaymentDomainEventId: string;
  }): Promise<void> {
    const maxAttempts = 3;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.repository.recordPrepaymentBookingSyncDegraded(input);
        return;
      } catch (error: unknown) {
        lastError = error;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
        }
      }
    }
    metricsRegistry.increment(
      "finance_prepayment_booking_sync_degraded_persist_failed_total",
      { tenant_id: input.tenantId },
      1
    );
    console.error(
      JSON.stringify({
        event: "finance.prepayment.booking_sync.degraded_persist_failed",
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        paymentStatus: input.paymentStatus,
        prepaymentDomainEventId: input.prepaymentDomainEventId,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      })
    );
  }
}

export function createFinanceService(
  ledgerPolicy: FinanceLedgerPolicyPort,
  repository: FinanceRepositoryPort = createFinanceRepository(),
  bookingPayments: IBookingPaymentPort = new BookingPaymentAdapter(),
  receiptDefaults: FinanceReceiptDefaultsPort
): FinanceService {
  return new FinanceService(ledgerPolicy, repository, bookingPayments, receiptDefaults);
}
