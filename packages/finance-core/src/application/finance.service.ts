import { createHash } from "node:crypto";

import type {
  CreateManualPaymentBody,
  FinanceObligationPort,
  GenerateScheduleBody,
  PatchScheduleItemBody,
  RecordPrepaymentBody,
  ReviewReceiptBody,
  SubmitReceiptBody,
} from "@app-tour/finance-http-contracts";

import { compileRegistrationInvoice } from "../domain/compile-invoice-balances";
import { isZeroObligationMinor } from "../domain/obligation-override";
import { buildPaymentScheduleItems, reschedulePaymentScheduleItem, waivePaymentScheduleItem, type PaymentScheduleItem } from "../domain/schedule";
import {
  attachFinanceRegistrationContext,
  filterRowsByRegistrationId,
  filterRowsByTourId,
  type FinanceRegistrationContext,
} from "../domain/finance-registration-context";
import type { IBookingPaymentPort } from "../ports/booking-payment.port";
import type { FinanceActorContext, FinanceActorRole } from "../ports/finance-actor-context";
import type { FinanceAuthorizationPort } from "../ports/finance-access.port";
import type {
  FinanceCapabilityPort,
  FinanceWorkspaceGateResult,
} from "../ports/finance-capability.port";
import type { FinanceClockPort } from "../ports/finance-clock.port";
import type { FinanceLedgerPolicyPort } from "../ports/finance-ledger-policy.port";
import type { FinanceLoggerPort } from "../ports/finance-log.port";
import type { FinanceMetricsPort } from "../ports/finance-metrics.port";
import type { FinanceStorageDriverPort } from "../ports/finance-persistence-mode.port";
import type { FinanceReceiptDefaultsPort } from "../ports/finance-receipt-defaults.port";
import type { ReceiptProofStoragePort } from "../ports/finance-receipt-proof-url.port";
import type { FinanceLedgerOutboxRow, FinanceSummaryRow } from "../ports/finance-repository.port";
import type { FinanceRepositoryPort } from "../ports/finance-repository.port";
import type { FinanceSchedulePort } from "../ports/finance-schedule.port";
import type { RegistrationDisplayPort } from "../ports/registration-display.port";
import { nullFinanceObligationPort } from "../ports/null-finance-obligation.port";
import {
  FINANCE_LATENCY_BUDGET_MS,
  FINANCE_METRIC,
  type FinanceApproveMetricResult,
  type FinanceLatencyOperation,
  type FinanceLedgerCaptureMetricResult,
} from "./finance-metrics-catalog";

function isFinanceOperatorRole(role: FinanceActorRole): boolean {
  return role === "admin" || role === "owner";
}

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

function parseMinorDigits(value: string): bigint {
  return BigInt(value.replace(/\D/g, "") || "0");
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

function assertCompositionDep(name: string, value: unknown): void {
  if (value === null || value === undefined) {
    throw new Error(
      `FINANCE_SERVICE_DEP_REQUIRED: ${name} must be provided by the composition root`
    );
  }
}

export class FinanceService {
  constructor(
    private readonly ledgerPolicy: FinanceLedgerPolicyPort,
    private readonly repository: FinanceRepositoryPort,
    private readonly bookingPayments: IBookingPaymentPort,
    private readonly receiptDefaults: FinanceReceiptDefaultsPort,
    private readonly registrationDisplay: RegistrationDisplayPort,
    private readonly metrics: FinanceMetricsPort,
    private readonly storageDriver: FinanceStorageDriverPort,
    private readonly receiptProofStorage: ReceiptProofStoragePort,
    private readonly capability: FinanceCapabilityPort,
    private readonly authorization: FinanceAuthorizationPort,
    private readonly schedules: FinanceSchedulePort,
    private readonly logger: FinanceLoggerPort,
    private readonly clock: FinanceClockPort,
    private readonly obligation: FinanceObligationPort,
    private readonly obligationToleranceMinor: string = "0"
  ) {
    assertCompositionDep("ledgerPolicy", ledgerPolicy);
    assertCompositionDep("repository", repository);
    assertCompositionDep("bookingPayments", bookingPayments);
    assertCompositionDep("receiptDefaults", receiptDefaults);
    assertCompositionDep("registrationDisplay", registrationDisplay);
    assertCompositionDep("metrics", metrics);
    assertCompositionDep("storageDriver", storageDriver);
    assertCompositionDep("receiptProofStorage", receiptProofStorage);
    assertCompositionDep("capability", capability);
    assertCompositionDep("authorization", authorization);
    assertCompositionDep("schedules", schedules);
    assertCompositionDep("logger", logger);
    assertCompositionDep("clock", clock);
    assertCompositionDep("obligation", obligation);
  }

  private async gate(auth: FinanceActorContext): Promise<FinanceWorkspaceGateResult> {
    return this.capability.assertEnabled(auth.tenantId);
  }

  private metricLabels(
    auth: FinanceActorContext,
    workspaceType: string
  ): Readonly<Record<string, string>> {
    return {
      tenant_id: auth.tenantId,
      workspace_type: workspaceType,
    };
  }

  private recordApprove(
    auth: FinanceActorContext,
    workspaceType: string,
    result: FinanceApproveMetricResult
  ): void {
    this.metrics.increment(FINANCE_METRIC.approve, {
      ...this.metricLabels(auth, workspaceType),
      result,
    });
  }

  private recordLedgerCapture(
    auth: FinanceActorContext,
    workspaceType: string,
    result: FinanceLedgerCaptureMetricResult
  ): void {
    this.metrics.increment(FINANCE_METRIC.ledgerCapture, {
      ...this.metricLabels(auth, workspaceType),
      result,
    });
  }

  private recordLatency(
    auth: FinanceActorContext,
    workspaceType: string,
    operation: FinanceLatencyOperation,
    startedAtMs: number
  ): void {
    const elapsed = Math.max(0, Date.now() - startedAtMs);
    const labels = this.metricLabels(auth, workspaceType);
    const gaugeName =
      operation === "payment"
        ? FINANCE_METRIC.paymentLatencyMs
        : operation === "approve"
          ? FINANCE_METRIC.approveLatencyMs
          : FINANCE_METRIC.ledgerLatencyMs;
    this.metrics.observe?.(gaugeName, elapsed, labels);
    if (elapsed > FINANCE_LATENCY_BUDGET_MS[operation]) {
      this.metrics.increment(FINANCE_METRIC.latencyBudgetExceeded, {
        ...labels,
        operation,
      });
    }
  }

  private static emptySummary(): FinanceSummaryRow {
    return {
      pendingManualPayments: 0,
      pendingReceiptReviews: 0,
      paidPayments: 0,
      failedPayments: 0,
    };
  }

  private async filterListRowsByScope<T extends { readonly registrationId: string }>(
    tenantId: string,
    rows: readonly T[],
    registrationId?: string,
    tourId?: string
  ): Promise<{ rows: readonly T[]; contexts: ReadonlyMap<string, FinanceRegistrationContext> }> {
    let filtered = filterRowsByRegistrationId(rows, registrationId);
    const contexts = await this.registrationDisplay.getByRegistrationIds(
      tenantId,
      filtered.map((row) => row.registrationId)
    );
    if (tourId !== undefined) {
      filtered = filterRowsByTourId(filtered, tourId, contexts);
    }
    return { rows: filtered, contexts };
  }

  async getSummary(auth: FinanceActorContext) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    if (!this.storageDriver.isDatabaseConfigured()) {
      return FinanceService.emptySummary();
    }
    return this.repository.getSummary(auth.tenantId);
  }

  async getReportByTour(auth: FinanceActorContext, tourId?: string) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    if (!this.storageDriver.isDatabaseConfigured()) {
      return { items: [] as const };
    }
    const items = await this.repository.listPaymentsByTourAggregate(auth.tenantId, tourId);
    return { items };
  }

  async listOpenPayments(
    auth: FinanceActorContext,
    limit: number,
    registrationId?: string,
    tourId?: string
  ) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    const scoped = await this.filterListRowsByScope(
      auth.tenantId,
      await this.repository.listOpenPayments(auth.tenantId, limit),
      registrationId,
      tourId
    );
    return scoped.rows.map((row) =>
      attachFinanceRegistrationContext(
        {
          ...row,
          createdAt: row.createdAt.toISOString(),
        },
        scoped.contexts
      )
    );
  }

  async listPayments(
    auth: FinanceActorContext,
    limit: number,
    registrationId?: string,
    tourId?: string
  ) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    const scoped = await this.filterListRowsByScope(
      auth.tenantId,
      await this.repository.listPayments(auth.tenantId, limit),
      registrationId,
      tourId
    );
    return scoped.rows.map((row) =>
      attachFinanceRegistrationContext(
        {
          ...row,
          createdAt: row.createdAt.toISOString(),
          paidAt: row.paidAt?.toISOString() ?? null,
        },
        scoped.contexts
      )
    );
  }

  async listLedgerEvents(
    auth: FinanceActorContext,
    limit: number,
    registrationId?: string,
    tourId?: string
  ) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    const mapped = (await this.repository.listLedgerEvents(auth.tenantId, limit)).map(
      mapLedgerEventRow
    );
    const withRegistration = mapped.filter(
      (row): row is typeof row & { registrationId: string } =>
        typeof row.registrationId === "string" && row.registrationId.length > 0
    );
    let filtered =
      registrationId === undefined
        ? mapped
        : mapped.filter((row) => row.registrationId === registrationId);
    if (tourId !== undefined) {
      const contexts = await this.registrationDisplay.getByRegistrationIds(
        auth.tenantId,
        withRegistration.map((row) => row.registrationId)
      );
      filtered = filtered.filter((row) => {
        if (typeof row.registrationId !== "string" || row.registrationId.length === 0) {
          return false;
        }
        return contexts.get(row.registrationId)?.tourId === tourId;
      });
    }
    const contexts = await this.registrationDisplay.getByRegistrationIds(
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

  async listPendingReceipts(
    auth: FinanceActorContext,
    limit: number,
    registrationId?: string,
    tourId?: string
  ) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
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
    const withRegistration = mapped.filter((row) => row.registrationId.length > 0);
    const scoped = await this.filterListRowsByScope(
      auth.tenantId,
      withRegistration,
      registrationId,
      tourId
    );
    const list =
      registrationId === undefined && tourId === undefined
        ? mapped
        : scoped.rows;
    const contexts =
      registrationId === undefined && tourId === undefined
        ? await this.registrationDisplay.getByRegistrationIds(
            auth.tenantId,
            withRegistration.map((row) => row.registrationId)
          )
        : scoped.contexts;
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
    auth: FinanceActorContext,
    body: CreateManualPaymentBody,
    idempotencyKey: string
  ) {
    const startedAtMs = Date.now();
    const gate = await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
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
      this.metrics.increment(
        FINANCE_METRIC.paymentCreated,
        this.metricLabels(auth, gate.workspaceType)
      );
      this.recordLatency(auth, gate.workspaceType, "payment", startedAtMs);
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
    const obligation = await this.obligation.resolveRegistrationObligation({
      tenantId: auth.tenantId,
      registrationId: body.registrationId,
    });
    if (obligation !== null) {
      const maxAllowed =
        parseMinorDigits(obligation.obligationMinor) + parseMinorDigits(this.obligationToleranceMinor);
      if (parseMinorDigits(body.amount) > maxAllowed) {
        this.logger.warn({
          event: "finance.obligation.manual_amount_override",
          tenantId: auth.tenantId,
          registrationId: body.registrationId,
          amountMinor: body.amount,
          obligationMinor: obligation.obligationMinor,
          toleranceMinor: this.obligationToleranceMinor,
          source: obligation.source,
        });
      }
    }
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
    this.metrics.increment(
      FINANCE_METRIC.paymentCreated,
      this.metricLabels(auth, gate.workspaceType)
    );
    this.recordLatency(auth, gate.workspaceType, "payment", startedAtMs);
    return {
      ...payment,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
    };
  }

  async submitReceipt(
    auth: FinanceActorContext,
    body: SubmitReceiptBody,
    idempotencyKey?: string
  ) {
    const gate = await this.gate(auth);
    this.authorization.assertReceiptSubmitAccess(auth);
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
    // Members may only attach proofs to payments for registrations they own.
    // Operators (admin/owner) retain in-tenant submit without per-registration ownership.
    if (!isFinanceOperatorRole(auth.role)) {
      const owns = await this.bookingPayments.memberOwnsRegistration({
        tenantId: auth.tenantId,
        registrationId: payment.registrationId,
        userId: auth.userId,
      });
      if (!owns) {
        throw new Error("BOOKINGS_FORBIDDEN");
      }
    }
    const receipt = await this.repository.createReceipt({
      tenantId: auth.tenantId,
      paymentId: payment.id,
      fileKey: body.fileKey,
      note: body.note,
      ...(idempotencyKeyHash !== undefined ? { idempotencyKeyHash } : {}),
    });
    this.metrics.increment(
      FINANCE_METRIC.receiptSubmitted,
      this.metricLabels(auth, gate.workspaceType)
    );
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
    auth: FinanceActorContext,
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

    const lifecycle = await this.bookingPayments.getRegistrationLifecycleStatus({
      tenantId: auth.tenantId,
      registrationId: input.registrationId,
    });
    if (lifecycle !== "approved") {
      throw new Error("FINANCE_RECEIPT_REQUIRES_APPROVED_BOOKING");
    }

    const paymentStatus = await this.bookingPayments.getPaymentStatus({
      tenantId: auth.tenantId,
      registrationId: input.registrationId,
    });
    if (paymentStatus === "paid") {
      throw new Error("FINANCE_RECEIPT_NOT_REQUIRED");
    }

    const collection = await this.obligation.resolveRegistrationPaymentCollection({
      tenantId: auth.tenantId,
      registrationId: input.registrationId,
    });
    if (collection === "free") {
      throw new Error("FINANCE_RECEIPT_NOT_REQUIRED");
    }
    const obligationForGate = await this.obligation.resolveRegistrationObligation({
      tenantId: auth.tenantId,
      registrationId: input.registrationId,
    });
    if (
      obligationForGate !== null &&
      isZeroObligationMinor(obligationForGate.obligationMinor)
    ) {
      throw new Error("FINANCE_RECEIPT_NOT_REQUIRED");
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
      const obligation = await this.obligation.resolveRegistrationObligation({
        tenantId: auth.tenantId,
        registrationId: input.registrationId,
      });
      const offlineDefaults = this.receiptDefaults.offlineReceiptPaymentDefaults();
      const amount =
        obligation !== null ? obligation.obligationMinor : offlineDefaults.amountMinor;
      const currency =
        obligation !== null ? obligation.currency : offlineDefaults.currency;
      payment = await this.repository.createManualPayment({
        tenantId: auth.tenantId,
        registrationId: input.registrationId,
        amount,
        currency,
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

  /**
   * Phase 4/5 — after booking approve (or zero override), mark paymentStatus=paid when
   * collection is `free` or resolved obligation is zero. No-op otherwise. No ledger.
   */
  async applyFreeCollectionPayment(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<{ readonly applied: boolean; readonly paymentStatus: "unpaid" | "partial" | "paid" | null }> {
    const lifecycle = await this.bookingPayments.getRegistrationLifecycleStatus({
      tenantId: input.tenantId,
      registrationId: input.registrationId,
    });
    if (lifecycle !== "approved") {
      const current = await this.bookingPayments.getPaymentStatus({
        tenantId: input.tenantId,
        registrationId: input.registrationId,
      });
      return { applied: false, paymentStatus: current };
    }

    const collection = await this.obligation.resolveRegistrationPaymentCollection({
      tenantId: input.tenantId,
      registrationId: input.registrationId,
    });
    const obligation = await this.obligation.resolveRegistrationObligation({
      tenantId: input.tenantId,
      registrationId: input.registrationId,
    });
    const zeroObligation =
      obligation !== null && isZeroObligationMinor(obligation.obligationMinor);
    if (collection !== "free" && !zeroObligation) {
      const current = await this.bookingPayments.getPaymentStatus({
        tenantId: input.tenantId,
        registrationId: input.registrationId,
      });
      return { applied: false, paymentStatus: current };
    }

    const current = await this.bookingPayments.getPaymentStatus({
      tenantId: input.tenantId,
      registrationId: input.registrationId,
    });
    if (current === "paid") {
      return { applied: false, paymentStatus: "paid" };
    }

    const paymentStatus = await this.raiseBookingPaymentStatus(
      input.tenantId,
      input.registrationId,
      "paid"
    );
    return { applied: true, paymentStatus };
  }

  /**
   * Phase 5 — ops sets per-registration obligation (discount / waive amount).
   */
  async setRegistrationObligationOverride(
    auth: FinanceActorContext,
    input: {
      readonly registrationId: string;
      readonly obligationMinor: string;
      readonly reason?: string;
    }
  ): Promise<{
    readonly registrationId: string;
    readonly obligationMinor: string;
    readonly source: "operator_override";
    readonly paymentStatus: "unpaid" | "partial" | "paid" | null;
    readonly freePaidApplied: boolean;
  }> {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);

    const written = await this.obligation.setRegistrationObligationOverride({
      tenantId: auth.tenantId,
      registrationId: input.registrationId,
      obligationMinor: input.obligationMinor,
      setAt: this.clock.nowIso(),
      setByUserId: auth.userId,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
    });
    if (!written) {
      throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_MISS");
    }

    const freePaid = await this.applyFreeCollectionPayment({
      tenantId: auth.tenantId,
      registrationId: input.registrationId,
    });

    return {
      registrationId: input.registrationId,
      obligationMinor: input.obligationMinor.trim(),
      source: "operator_override",
      paymentStatus: freePaid.paymentStatus,
      freePaidApplied: freePaid.applied,
    };
  }

  async getMemberReceiptStatusForRegistration(
    auth: FinanceActorContext,
    registrationId: string
  ): Promise<{ readonly status: "none" | "pending" | "rejected" | "paid" }> {
    await this.gate(auth);
    this.authorization.assertReceiptSubmitAccess(auth);

    const owns = await this.bookingPayments.memberOwnsRegistration({
      tenantId: auth.tenantId,
      registrationId,
      userId: auth.userId,
    });
    if (!owns) {
      throw new Error("BOOKINGS_FORBIDDEN");
    }

    const bookingPaymentStatus = await this.bookingPayments.getPaymentStatus({
      tenantId: auth.tenantId,
      registrationId,
    });
    if (bookingPaymentStatus === "paid") {
      return { status: "paid" };
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

  async reviewReceipt(auth: FinanceActorContext, receiptId: string, body: ReviewReceiptBody) {
    const gate = await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
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
      this.recordApprove(auth, gate.workspaceType, "replay");
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

    if (body.decision === "approve") {
      const obligation = await this.obligation.resolveRegistrationObligation({
        tenantId: auth.tenantId,
        registrationId: payment.registrationId,
      });
      if (obligation !== null) {
        const maxAllowed =
          parseMinorDigits(obligation.obligationMinor) + parseMinorDigits(this.obligationToleranceMinor);
        if (parseMinorDigits(payment.amount) > maxAllowed) {
          throw new Error("FINANCE_OBLIGATION_OVERPAY");
        }
      }
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

    const approveStartedAtMs = Date.now();
    const paidAtIso = this.clock.nowIso();
    let ledgerCapture;
    const ledgerStartedAtMs = Date.now();
    try {
      ledgerCapture = this.ledgerPolicy.buildPaymentCaptureJournal({
        tenantId: auth.tenantId,
        paymentId: payment.id,
        registrationId: payment.registrationId,
        amountMinor: payment.amount,
        currency: payment.currency,
        capturedAtIso: paidAtIso,
      });
      this.recordLatency(auth, gate.workspaceType, "ledger", ledgerStartedAtMs);
    } catch (error: unknown) {
      this.recordLatency(auth, gate.workspaceType, "ledger", ledgerStartedAtMs);
      this.recordApprove(auth, gate.workspaceType, "failure");
      this.recordLedgerCapture(auth, gate.workspaceType, "failure");
      this.recordLatency(auth, gate.workspaceType, "approve", approveStartedAtMs);
      throw error;
    }

    // Durable path: refuse empty journals before any Paid/Approved mutation.
    if (this.storageDriver.isDurablePersistence() && ledgerCapture.lines.length === 0) {
      this.recordApprove(auth, gate.workspaceType, "failure");
      this.recordLedgerCapture(auth, gate.workspaceType, "skipped_empty");
      this.recordLatency(auth, gate.workspaceType, "approve", approveStartedAtMs);
      throw new Error("FINANCE_LEDGER_CAPTURE_EMPTY");
    }

    // Single RLS transaction: payment Paid → booking paid → receipt Approved → ledger.
    // Memory fake: fail-closed simulate via repository (not production-equivalent).
    try {
      const approved = await this.repository.approveManualReceiptAtomic({
        tenantId: auth.tenantId,
        paymentId: payment.id,
        receiptId,
        registrationId: payment.registrationId,
        journalId: ledgerCapture.journalId,
        reviewedByUserId: auth.userId,
        ...(body.reviewNote !== undefined ? { reviewNote: body.reviewNote } : {}),
        ...(this.storageDriver.isDurablePersistence() ? { ledgerCapture } : {}),
      });
      this.recordApprove(auth, gate.workspaceType, "success");
      if (!this.storageDriver.isDurablePersistence()) {
        this.recordLedgerCapture(auth, gate.workspaceType, "omitted_non_durable");
      } else {
        this.recordLedgerCapture(auth, gate.workspaceType, "success");
      }
      this.recordLatency(auth, gate.workspaceType, "approve", approveStartedAtMs);
      return approved;
    } catch (error: unknown) {
      // Concurrent approve: loser may lose Pending guards; if winner already committed, replay.
      if (!(error instanceof Error) || error.message !== "FINANCE_APPROVE_CONFLICT") {
        this.recordApprove(auth, gate.workspaceType, "failure");
        this.recordLedgerCapture(auth, gate.workspaceType, "failure");
        this.recordLatency(auth, gate.workspaceType, "approve", approveStartedAtMs);
        throw error;
      }
      const latest = await this.repository.findReceiptById(auth.tenantId, receiptId);
      if (
        latest !== null &&
        latest.status === "Approved" &&
        latest.payment !== null &&
        latest.payment.status === "Paid"
      ) {
        this.recordApprove(auth, gate.workspaceType, "replay");
        this.recordLatency(auth, gate.workspaceType, "approve", approveStartedAtMs);
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
      this.recordApprove(auth, gate.workspaceType, "failure");
      this.recordLedgerCapture(auth, gate.workspaceType, "failure");
      this.recordLatency(auth, gate.workspaceType, "approve", approveStartedAtMs);
      throw error;
    }
  }

  async getReceiptUrl(auth: FinanceActorContext, receiptId: string) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    const receipt = await this.repository.findReceiptById(auth.tenantId, receiptId);
    if (receipt === null) {
      throw new Error("FINANCE_RECEIPT_NOT_FOUND");
    }
    try {
      const url = await this.receiptProofStorage.getSignedReadUrl({
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

  async listPrepayments(
    auth: FinanceActorContext,
    limit: number,
    registrationId?: string,
    tourId?: string
  ) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    const scoped = await this.filterListRowsByScope(
      auth.tenantId,
      await this.repository.listPrepayments(auth.tenantId, limit),
      registrationId,
      tourId
    );
    return scoped.rows.map((row) => attachFinanceRegistrationContext(row, scoped.contexts));
  }

  async recordPrepayment(
    auth: FinanceActorContext,
    body: RecordPrepaymentBody,
    idempotencyKey: string
  ): Promise<Record<string, unknown>> {
    const gate = await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    const trimmedKey = idempotencyKey.trim();
    if (trimmedKey.length === 0) {
      throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    }
    const method = body.method.trim().length > 0 ? body.method.trim() : "Manual";
    const ids = buildPrepaymentDomainEventIds(body.registrationId, trimmedKey);
    const recordedAtIso = this.clock.nowIso();
    let ledgerCapture;
    try {
      ledgerCapture = this.ledgerPolicy.buildPrepaymentJournal({
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
    } catch (error: unknown) {
      this.recordLedgerCapture(auth, gate.workspaceType, "failure");
      throw error;
    }

    if (ledgerCapture.lines.length === 0) {
      this.recordLedgerCapture(auth, gate.workspaceType, "skipped_empty");
      throw new Error("FINANCE_LEDGER_CAPTURE_EMPTY");
    }

    try {
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

      this.recordLedgerCapture(auth, gate.workspaceType, "success");

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
    } catch (error: unknown) {
      this.recordLedgerCapture(auth, gate.workspaceType, "failure");
      throw error;
    }
  }

  async listPrepaymentBookingSyncDegraded(auth: FinanceActorContext, limit: number) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    return this.repository.listOpenPrepaymentBookingSyncDegraded(auth.tenantId, limit);
  }

  async retryPrepaymentBookingSync(
    auth: FinanceActorContext,
    registrationId: string
  ): Promise<Record<string, unknown>> {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
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

  async listPaymentSchedules(
    auth: FinanceActorContext,
    registrationId?: string,
    tourId?: string
  ) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    const scoped = await this.filterListRowsByScope(
      auth.tenantId,
      await this.schedules.listAllSchedules(auth.tenantId),
      registrationId,
      tourId
    );
    return scoped.rows.map((row) => attachFinanceRegistrationContext(row, scoped.contexts));
  }

  async getPaymentSchedule(auth: FinanceActorContext, registrationId: string) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    return this.schedules.getSchedule(auth.tenantId, registrationId);
  }

  async generatePaymentSchedule(auth: FinanceActorContext, body: GenerateScheduleBody) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    const items = buildPaymentScheduleItems({
      registrationId: body.registrationId,
      template: body.template,
    });
    await this.schedules.putSchedule(auth.tenantId, body.registrationId, items);
    return { registrationId: body.registrationId, items };
  }

  async patchPaymentScheduleItem(
    auth: FinanceActorContext,
    registrationId: string,
    itemId: string,
    body: PatchScheduleItemBody
  ) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    const normalizedRegistrationId = registrationId.trim();
    const normalizedItemId = itemId.trim();
    const existing = await this.schedules.getSchedule(auth.tenantId, normalizedRegistrationId);
    if (existing.length === 0) {
      throw new Error("SCHEDULE_NOT_FOUND");
    }

    let nextItems: readonly PaymentScheduleItem[];
    if (body.action === "waive") {
      this.assertAdminAccess(auth);
      nextItems = waivePaymentScheduleItem(existing, normalizedItemId);
    } else {
      nextItems = reschedulePaymentScheduleItem(existing, normalizedItemId, body.dueAt);
    }

    await this.schedules.putSchedule(auth.tenantId, normalizedRegistrationId, nextItems);
    const updated = nextItems.find((row) => row.id === normalizedItemId);
    if (updated === undefined) {
      throw new Error("SCHEDULE_ITEM_NOT_FOUND");
    }
    return {
      registrationId: normalizedRegistrationId,
      item: updated,
      audit:
        body.action === "waive"
          ? {
              eventType: "finance.schedule.item_waived" as const,
              reason: body.reason,
              actorUserId: auth.userId,
            }
          : null,
    };
  }

  private assertAdminAccess(auth: FinanceActorContext): void {
    if (auth.role !== "admin" && auth.role !== "owner") {
      throw new Error("FORBIDDEN_ADMIN_REQUIRED");
    }
  }

  async getRegistrationInvoice(auth: FinanceActorContext, registrationId: string) {
    await this.gate(auth);
    this.authorization.assertOperatorAccess(auth);
    const normalizedRegistrationId = registrationId.trim();
    const facts = await this.repository.getRegistrationInvoiceFacts(
      auth.tenantId,
      normalizedRegistrationId
    );
    const scheduleItems = await this.schedules.getSchedule(auth.tenantId, normalizedRegistrationId);
    const obligation = await this.obligation.resolveRegistrationObligation({
      tenantId: auth.tenantId,
      registrationId: normalizedRegistrationId,
    });
    return compileRegistrationInvoice({
      registrationId: normalizedRegistrationId,
      currency: facts.currency,
      prepaymentMinor: facts.prepaymentMinor,
      paidPaymentsMinor: facts.paidPaymentsMinor,
      paymentAmountsMinor: facts.paymentAmountsMinor,
      scheduleAmountsMinor: scheduleItems.map((item) => item.amountMinor),
      ...(obligation !== null ? { obligationMinor: obligation.obligationMinor } : {}),
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
        this.logger.warn({
            event: "finance.booking_payment_sync.miss",
            tenantId,
            registrationId,
            paymentStatus,
          });
        throw new Error("FINANCE_BOOKING_PAYMENT_SYNC_MISS");
      }
      return updated;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "FINANCE_BOOKING_PAYMENT_SYNC_MISS") {
        throw error;
      }
      this.logger.warn({
          event: "finance.booking_payment_sync.failed",
          tenantId,
          registrationId,
          paymentStatus,
          error: error instanceof Error ? error.message : String(error),
        });
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
      this.logger.warn({
          event: "finance.prepayment.booking_sync.degraded",
          tenantId,
          registrationId,
          paymentStatus,
          error: message,
          prepaymentDomainEventId: prepaymentDomainEventId ?? null,
        });
      if (this.storageDriver.isDurablePersistence()) {
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
    this.metrics.increment(
      FINANCE_METRIC.prepaymentDegradedPersistFailed,
      { tenant_id: input.tenantId },
      1
    );
    this.logger.error({
        event: "finance.prepayment.booking_sync.degraded_persist_failed",
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        paymentStatus: input.paymentStatus,
        prepaymentDomainEventId: input.prepaymentDomainEventId,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      });
  }
}

export function createFinanceService(
  ledgerPolicy: FinanceLedgerPolicyPort,
  repository: FinanceRepositoryPort,
  bookingPayments: IBookingPaymentPort,
  receiptDefaults: FinanceReceiptDefaultsPort,
  registrationDisplay: RegistrationDisplayPort,
  metrics: FinanceMetricsPort,
  storageDriver: FinanceStorageDriverPort,
  receiptProofStorage: ReceiptProofStoragePort,
  capability: FinanceCapabilityPort,
  authorization: FinanceAuthorizationPort,
  schedules: FinanceSchedulePort,
  logger: FinanceLoggerPort,
  clock: FinanceClockPort,
  obligation: FinanceObligationPort = nullFinanceObligationPort,
  obligationToleranceMinor = "0"
): FinanceService {
  return new FinanceService(
    ledgerPolicy,
    repository,
    bookingPayments,
    receiptDefaults,
    registrationDisplay,
    metrics,
    storageDriver,
    receiptProofStorage,
    capability,
    authorization,
    schedules,
    logger,
    clock,
    obligation,
    obligationToleranceMinor
  );
}
