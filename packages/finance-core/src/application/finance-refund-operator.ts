/**
 * PR23-E2/E3 — operator refund helpers extracted from FinanceService (behavior-neutral).
 * Commands stay on FinanceService; this module owns row mapping, cap/source resolution,
 * and list/detail enrichment.
 */
import {
  buildFinanceExceptionPaymentsHref,
  buildFinanceExceptionReceiptsHref,
} from "../domain/finance-exception";
import type { FinanceRegistrationContext } from "../domain/finance-registration-context";
import type { RegistrationInvoiceReadModel } from "../domain/compile-invoice-balances";
import {
  decodeOperatorRefundCursor,
  encodeOperatorRefundCursor,
  paymentScopedRefundableCapMinor,
  prepaymentScopedRefundableCapMinor,
  REFUND_STATUSES,
  type RefundSourceKind,
  type RefundStatus,
} from "../domain/refund";
import type { FinanceRepositoryPort } from "../ports/finance-repository.port";
import type { RegistrationDisplayPort } from "../ports/registration-display.port";
import { normalizeListLimit } from "./finance-read-enrichment";

export type OperatorRefundInvoiceSnapshot = {
  readonly totalMinor: string;
  readonly paidMinor: string;
  readonly remainingMinor: string;
  readonly refundedMinor: string;
  readonly currency: string;
};

export type OperatorRefundLinkedPayment = {
  readonly id: string;
  readonly amount: string;
  readonly currency: string;
  readonly status: string;
  readonly method: string;
};

export type OperatorRefundItem = {
  readonly id: string;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly paymentId: string | null;
  readonly sourceKind: RefundSourceKind;
  readonly amountMinor: string;
  readonly currency: string;
  readonly reasonCode: string;
  readonly reasonNote: string | null;
  readonly status: RefundStatus;
  readonly requestedAt: string;
  readonly requestedByUserId: string;
  readonly approvedAt: string | null;
  readonly approvedByUserId: string | null;
  readonly rejectedAt: string | null;
  readonly rejectedByUserId: string | null;
  readonly rejectNote: string | null;
  readonly cancelledAt: string | null;
  readonly cancelledByUserId: string | null;
  readonly completedAt: string | null;
  readonly completedByUserId: string | null;
  readonly completionNote: string | null;
  readonly evidenceFileKey: string | null;
  readonly evidenceNote: string | null;
  readonly creationIdempotencyKey: string | null;
  readonly identity: {
    readonly memberDisplayName: string | null;
    readonly tourTitle: string | null;
    readonly tourId: string | null;
  };
  readonly invoice: OperatorRefundInvoiceSnapshot | null;
  readonly href: {
    readonly payments: string;
    readonly receipts: string;
  };
  readonly linkedPayment: OperatorRefundLinkedPayment | null;
};

export type FinanceRefundRecord = NonNullable<
  Awaited<ReturnType<FinanceRepositoryPort["findRefundById"]>>
>;

export type FinanceRefundOperatorDeps = {
  readonly repository: FinanceRepositoryPort;
  readonly compileRegistrationInvoice: (
    tenantId: string,
    registrationId: string
  ) => Promise<RegistrationInvoiceReadModel>;
  readonly registrationDisplay: RegistrationDisplayPort;
};

function parseMinorDigits(value: string): bigint {
  return BigInt(value.replace(/\D/g, "") || "0");
}

function isRefundStatus(value: string): value is RefundStatus {
  return (REFUND_STATUSES as readonly string[]).includes(value);
}

export function mapRefundRow(row: Awaited<ReturnType<FinanceRepositoryPort["findRefundById"]>>) {
  if (row === null) {
    throw new Error("REFUND_NOT_FOUND");
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    registrationId: row.registrationId,
    paymentId: row.paymentId,
    sourceKind: row.sourceKind,
    amountMinor: row.amountMinor,
    currency: row.currency,
    reasonCode: row.reasonCode,
    reasonNote: row.reasonNote,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    requestedByUserId: row.requestedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedByUserId: row.approvedByUserId,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectedByUserId: row.rejectedByUserId,
    rejectNote: row.rejectNote,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledByUserId: row.cancelledByUserId,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedByUserId: row.completedByUserId,
    completionNote: row.completionNote,
    evidenceFileKey: row.evidenceFileKey,
    evidenceNote: row.evidenceNote,
    creationIdempotencyKey: row.creationIdempotencyKey,
  };
}

export function toOperatorRefundInvoiceSnapshot(
  invoice: Pick<
    RegistrationInvoiceReadModel,
    "invoiceTotalMinor" | "paidAmountMinor" | "balanceDueMinor" | "refundedMinor" | "currency"
  >
): OperatorRefundInvoiceSnapshot {
  return {
    totalMinor: invoice.invoiceTotalMinor,
    paidMinor: invoice.paidAmountMinor,
    remainingMinor: invoice.balanceDueMinor,
    refundedMinor: invoice.refundedMinor,
    currency: invoice.currency,
  };
}

export function normalizeOperatorRefundListQuery(query: {
  readonly limit?: number;
  readonly cursor?: string | null;
  readonly registrationId?: string;
  readonly status?: string;
}): {
  readonly limit: number;
  readonly cursor: { requestedAt: string; id: string } | null;
  readonly registrationId?: string;
  readonly status?: RefundStatus;
} {
  const limit = normalizeListLimit(query.limit);

  let status: RefundStatus | undefined;
  if (typeof query.status === "string" && query.status.trim().length > 0) {
    const trimmed = query.status.trim();
    if (!isRefundStatus(trimmed)) {
      throw new Error("ZOD_VALIDATION_FAILED: status must be a RefundStatus");
    }
    status = trimmed;
  }

  const registrationId =
    typeof query.registrationId === "string" && query.registrationId.trim().length > 0
      ? query.registrationId.trim()
      : undefined;

  let cursor: { requestedAt: string; id: string } | null = null;
  if (typeof query.cursor === "string" && query.cursor.trim().length > 0) {
    const decoded = decodeOperatorRefundCursor(query.cursor);
    if (decoded === null) {
      throw new Error("ZOD_VALIDATION_FAILED: cursor is invalid");
    }
    cursor = {
      requestedAt: decoded.requestedAt.toISOString(),
      id: decoded.id,
    };
  }

  return {
    limit,
    cursor,
    ...(registrationId !== undefined ? { registrationId } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

export function buildOperatorRefundNextCursor(input: {
  readonly hasMore: boolean;
  readonly rows: readonly { readonly id: string; readonly requestedAt: Date }[];
}): string | null {
  const last = input.rows[input.rows.length - 1];
  if (!input.hasMore || last === undefined) {
    return null;
  }
  return encodeOperatorRefundCursor({
    requestedAt: last.requestedAt,
    id: last.id,
  });
}

export async function loadRefundOrThrowNotFound(
  deps: FinanceRefundOperatorDeps,
  tenantId: string,
  refundId: string
): Promise<FinanceRefundRecord> {
  const existing = await deps.repository.findRefundById(tenantId, refundId);
  if (existing === null) {
    throw new Error("REFUND_NOT_FOUND");
  }
  return existing;
}

export async function buildRefundResultWithInvoice(
  deps: FinanceRefundOperatorDeps,
  input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly refundRow: Awaited<ReturnType<FinanceRepositoryPort["findRefundById"]>>;
    readonly replay: boolean;
  }
) {
  const invoice = await deps.compileRegistrationInvoice(input.tenantId, input.registrationId);
  return {
    refund: mapRefundRow(input.refundRow),
    replay: input.replay,
    invoice: toOperatorRefundInvoiceSnapshot(invoice),
    balanceDueMinor: invoice.balanceDueMinor,
  } as const;
}

async function tryBuildOperatorRefundInvoiceSnapshot(
  deps: FinanceRefundOperatorDeps,
  tenantId: string,
  registrationId: string
): Promise<OperatorRefundInvoiceSnapshot | null> {
  try {
    const compiled = await deps.compileRegistrationInvoice(tenantId, registrationId);
    return toOperatorRefundInvoiceSnapshot(compiled);
  } catch {
    return null;
  }
}

async function loadOperatorRefundLinkedPayment(
  deps: FinanceRefundOperatorDeps,
  tenantId: string,
  paymentId: string | null
): Promise<OperatorRefundLinkedPayment | null> {
  if (paymentId === null) {
    return null;
  }
  const payment = await deps.repository.findPaymentById(tenantId, paymentId);
  if (payment === null) {
    return null;
  }
  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    method: payment.method,
  };
}

async function buildOperatorRefundItem(
  deps: FinanceRefundOperatorDeps,
  input: {
    readonly tenantId: string;
    readonly row: FinanceRefundRecord;
    readonly context: FinanceRegistrationContext | undefined;
  }
): Promise<OperatorRefundItem> {
  const mapped = mapRefundRow(input.row);
  const invoice = await tryBuildOperatorRefundInvoiceSnapshot(
    deps,
    input.tenantId,
    input.row.registrationId
  );
  const linkedPayment = await loadOperatorRefundLinkedPayment(
    deps,
    input.tenantId,
    input.row.paymentId
  );
  return {
    ...mapped,
    identity: {
      memberDisplayName: input.context?.memberDisplayName ?? null,
      tourTitle: input.context?.tourTitle ?? null,
      tourId: input.context?.tourId ?? null,
    },
    invoice,
    href: {
      payments: buildFinanceExceptionPaymentsHref(input.row.registrationId),
      receipts: buildFinanceExceptionReceiptsHref(input.row.registrationId),
    },
    linkedPayment,
  };
}

export async function enrichOperatorRefundRows(
  deps: FinanceRefundOperatorDeps,
  tenantId: string,
  rows: readonly FinanceRefundRecord[]
): Promise<OperatorRefundItem[]> {
  const registrationIds = [
    ...new Set(rows.map((row) => row.registrationId).filter((id) => id.length > 0)),
  ];
  const contexts = await deps.registrationDisplay.getByRegistrationIds(
    tenantId,
    registrationIds
  );

  const items: OperatorRefundItem[] = [];
  for (const row of rows) {
    const ctx = contexts.get(row.registrationId);
    items.push(
      await buildOperatorRefundItem(deps, {
        tenantId,
        row,
        context: ctx,
      })
    );
  }
  return items;
}

export async function resolveRefundableCapMinor(
  deps: FinanceRefundOperatorDeps,
  input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly sourceKind: RefundSourceKind;
    readonly paymentId: string | null;
    readonly excludeRefundId?: string;
  }
): Promise<bigint> {
  const facts = await deps.repository.getRegistrationInvoiceFacts(
    input.tenantId,
    input.registrationId
  );
  const refundedCompletedMinor = await deps.repository.sumCompletedRefundsMinor({
    tenantId: input.tenantId,
    registrationId: input.registrationId,
    ...(input.excludeRefundId !== undefined ? { excludeRefundId: input.excludeRefundId } : {}),
  });
  const base = {
    paidPaymentsMinor: facts.paidPaymentsMinor,
    prepaymentMinor: facts.prepaymentMinor,
    refundedCompletedMinor,
  };
  if (input.sourceKind === "payment") {
    if (input.paymentId === null) {
      throw new Error("REFUND_SOURCE_INVALID");
    }
    const payment = await deps.repository.findPaymentById(input.tenantId, input.paymentId);
    if (payment === null) {
      throw new Error("FINANCE_PAYMENT_NOT_FOUND");
    }
    const paymentRefundedCompletedMinor = await deps.repository.sumCompletedRefundsMinor({
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      paymentId: input.paymentId,
      ...(input.excludeRefundId !== undefined ? { excludeRefundId: input.excludeRefundId } : {}),
    });
    return paymentScopedRefundableCapMinor({
      ...base,
      paymentAmountMinor: payment.amount,
      paymentRefundedCompletedMinor,
    });
  }
  const prepaymentRefundedCompletedMinor = await deps.repository.sumCompletedRefundsMinor({
    tenantId: input.tenantId,
    registrationId: input.registrationId,
    sourceKind: "prepayment",
    ...(input.excludeRefundId !== undefined ? { excludeRefundId: input.excludeRefundId } : {}),
  });
  return prepaymentScopedRefundableCapMinor({
    ...base,
    prepaymentRefundedCompletedMinor,
  });
}

/**
 * Validate refund source payload and resolve normalized payment link.
 * Behavior-only extraction: no business-rule changes.
 */
export async function resolveRequestRefundSource(
  deps: FinanceRefundOperatorDeps,
  input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly sourceKind: RefundSourceKind;
    readonly paymentId?: string | null;
    readonly factsCurrency: string;
    readonly prepaymentMinor: string;
  }
): Promise<{ readonly paymentId: string | null }> {
  if (input.sourceKind === "payment") {
    const rawPaymentId = typeof input.paymentId === "string" ? input.paymentId.trim() : "";
    if (rawPaymentId.length === 0) {
      throw new Error("REFUND_SOURCE_INVALID");
    }
    const payment = await deps.repository.findPaymentById(input.tenantId, rawPaymentId);
    if (payment === null) {
      throw new Error("FINANCE_PAYMENT_NOT_FOUND");
    }
    if (payment.registrationId !== input.registrationId) {
      throw new Error("REFUND_SOURCE_INVALID");
    }
    if (payment.method !== "Manual") {
      throw new Error("REFUND_PAYMENT_NOT_MANUAL");
    }
    if (payment.status === "Pending" || payment.status === "Cancelled") {
      throw new Error("REFUND_PAYMENT_NOT_PAID");
    }
    if (payment.status !== "Paid") {
      throw new Error("REFUND_PAYMENT_NOT_PAID");
    }
    if (payment.currency.toUpperCase() !== input.factsCurrency.toUpperCase()) {
      throw new Error("REFUND_CURRENCY_MISMATCH");
    }
    return { paymentId: payment.id };
  }

  if (input.sourceKind === "prepayment") {
    if (
      input.paymentId !== undefined &&
      input.paymentId !== null &&
      String(input.paymentId).trim() !== ""
    ) {
      throw new Error("REFUND_SOURCE_INVALID");
    }
    if (parseMinorDigits(input.prepaymentMinor) <= BigInt(0)) {
      throw new Error("REFUND_OVER_CAP");
    }
    return { paymentId: null };
  }

  throw new Error("REFUND_SOURCE_INVALID");
}
