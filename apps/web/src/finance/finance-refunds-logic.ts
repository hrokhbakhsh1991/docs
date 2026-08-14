/**
 * PR23-E3 — refund operator UI helpers (parse/display/action visibility only).
 * Money nets and caps stay on the API / FinanceService.
 */

export const FINANCE_REFUNDS_TEST_IDS = {
  panel: "finance-refunds-panel",
  list: "finance-refunds-list",
  loading: "finance-refunds-loading",
  empty: "finance-refunds-empty",
  error: "finance-refunds-error",
  refresh: "finance-refunds-refresh",
  item: "finance-refund-item",
  status: "finance-refund-status",
  source: "finance-refund-source",
  amount: "finance-refund-amount",
  invoice: "finance-refund-invoice",
  requestForm: "finance-refund-request-form",
  approve: "finance-refund-approve",
  complete: "finance-refund-complete",
  reject: "finance-refund-reject",
  cancel: "finance-refund-cancel",
  openPayments: "finance-refund-open-payments",
  openReceipts: "finance-refund-open-receipts",
  openOutstanding: "finance-refund-open-outstanding",
  statusFilter: "finance-refund-status-filter",
  completeConfirm: "finance-refund-complete-confirm",
  completeSuccess: "finance-refund-complete-success",
  amountHero: "finance-refund-amount-hero",
  completeOpenPayments: "finance-refund-complete-open-payments",
} as const;

/** Outstanding handoff after Complete when invoice remaining reopens AR. */
export function refundOutstandingHref(registrationId: string): string {
  return `/finance?tab=outstanding&registrationId=${encodeURIComponent(registrationId)}`;
}

export function refundPaymentsHref(registrationId: string): string {
  return `/finance?tab=payments&registrationId=${encodeURIComponent(registrationId)}`;
}

export const REFUND_STATUSES = [
  "Requested",
  "Approved",
  "Completed",
  "Rejected",
  "Cancelled",
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_SOURCE_KINDS = ["payment", "prepayment"] as const;
export type RefundSourceKind = (typeof REFUND_SOURCE_KINDS)[number];

export type FinanceRefundListItem = {
  readonly id: string;
  readonly registrationId: string;
  readonly paymentId: string | null;
  readonly sourceKind: RefundSourceKind;
  readonly amountMinor: string;
  readonly currency: string;
  readonly reasonCode: string;
  readonly reasonNote: string | null;
  readonly status: RefundStatus;
  readonly requestedAt: string;
  readonly approvedAt: string | null;
  readonly completedAt: string | null;
  readonly rejectedAt: string | null;
  readonly cancelledAt: string | null;
  readonly evidenceFileKey: string | null;
  readonly identity: {
    readonly memberDisplayName: string | null;
    readonly tourTitle: string | null;
    readonly tourId: string | null;
  };
  readonly invoice: {
    readonly totalMinor: string;
    readonly paidMinor: string;
    readonly remainingMinor: string;
    readonly refundedMinor: string;
    readonly currency: string;
  } | null;
  readonly linkedPayment: {
    readonly id: string;
    readonly amount: string;
    readonly currency: string;
    readonly status: string;
    readonly method: string;
  } | null;
  readonly href: {
    readonly payments: string;
    readonly receipts: string;
  };
};

export type FinanceRefundsPage = {
  readonly items: readonly FinanceRefundListItem[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export function isRefundStatus(value: unknown): value is RefundStatus {
  return (REFUND_STATUSES as readonly string[]).includes(String(value));
}

export function isRefundSourceKind(value: unknown): value is RefundSourceKind {
  return value === "payment" || value === "prepayment";
}

export function sanitizeFinanceRefundHref(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/finance")) {
    return null;
  }
  if (trimmed.includes("://") || trimmed.includes("//")) {
    return null;
  }
  return trimmed;
}

function parseIdentity(raw: unknown): FinanceRefundListItem["identity"] {
  if (raw === null || typeof raw !== "object") {
    return { memberDisplayName: null, tourTitle: null, tourId: null };
  }
  const row = raw as Record<string, unknown>;
  return {
    memberDisplayName:
      typeof row.memberDisplayName === "string" ? row.memberDisplayName : null,
    tourTitle: typeof row.tourTitle === "string" ? row.tourTitle : null,
    tourId: typeof row.tourId === "string" ? row.tourId : null,
  };
}

function parseInvoice(raw: unknown): FinanceRefundListItem["invoice"] {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (
    typeof row.totalMinor !== "string" ||
    typeof row.paidMinor !== "string" ||
    typeof row.remainingMinor !== "string" ||
    typeof row.refundedMinor !== "string" ||
    typeof row.currency !== "string"
  ) {
    return null;
  }
  return {
    totalMinor: row.totalMinor,
    paidMinor: row.paidMinor,
    remainingMinor: row.remainingMinor,
    refundedMinor: row.refundedMinor,
    currency: row.currency,
  };
}

function parseLinkedPayment(raw: unknown): FinanceRefundListItem["linkedPayment"] {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.amount !== "string" ||
    typeof row.currency !== "string" ||
    typeof row.status !== "string" ||
    typeof row.method !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    method: row.method,
  };
}

export function parseFinanceRefundItem(raw: unknown): FinanceRefundListItem | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.registrationId !== "string") {
    return null;
  }
  if (!isRefundStatus(row.status) || !isRefundSourceKind(row.sourceKind)) {
    return null;
  }
  if (typeof row.amountMinor !== "string" || typeof row.currency !== "string") {
    return null;
  }
  if (typeof row.requestedAt !== "string" || typeof row.reasonCode !== "string") {
    return null;
  }
  const hrefRaw =
    row.href !== null && typeof row.href === "object"
      ? (row.href as Record<string, unknown>)
      : {};
  const paymentsHref =
    sanitizeFinanceRefundHref(hrefRaw.payments) ??
    `/finance?tab=payments&registrationId=${encodeURIComponent(row.registrationId)}`;
  const receiptsHref =
    sanitizeFinanceRefundHref(hrefRaw.receipts) ??
    `/finance?tab=receipts&registrationId=${encodeURIComponent(row.registrationId)}`;

  return {
    id: row.id,
    registrationId: row.registrationId,
    paymentId: typeof row.paymentId === "string" ? row.paymentId : null,
    sourceKind: row.sourceKind,
    amountMinor: row.amountMinor,
    currency: row.currency,
    reasonCode: row.reasonCode,
    reasonNote: typeof row.reasonNote === "string" ? row.reasonNote : null,
    status: row.status,
    requestedAt: row.requestedAt,
    approvedAt: typeof row.approvedAt === "string" ? row.approvedAt : null,
    completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
    rejectedAt: typeof row.rejectedAt === "string" ? row.rejectedAt : null,
    cancelledAt: typeof row.cancelledAt === "string" ? row.cancelledAt : null,
    evidenceFileKey: typeof row.evidenceFileKey === "string" ? row.evidenceFileKey : null,
    identity: parseIdentity(row.identity),
    invoice: parseInvoice(row.invoice),
    linkedPayment: parseLinkedPayment(row.linkedPayment),
    href: { payments: paymentsHref, receipts: receiptsHref },
  };
}

export function parseFinanceRefundsResponse(raw: unknown): FinanceRefundsPage {
  if (raw === null || typeof raw !== "object") {
    return { items: [], nextCursor: null, hasMore: false };
  }
  const body = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(body.items) ? body.items : [];
  const items: FinanceRefundListItem[] = [];
  for (const entry of itemsRaw) {
    const parsed = parseFinanceRefundItem(entry);
    if (parsed !== null) {
      items.push(parsed);
    }
  }
  return {
    items,
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
    hasMore: body.hasMore === true,
  };
}

/** Lifecycle action visibility — mirrors E2 transition matrix (presentation only). */
export function refundActionsForStatus(status: RefundStatus): {
  readonly approve: boolean;
  readonly complete: boolean;
  readonly reject: boolean;
  readonly cancel: boolean;
} {
  if (status === "Requested") {
    return { approve: true, complete: true, reject: true, cancel: true };
  }
  if (status === "Approved") {
    return { approve: false, complete: true, reject: true, cancel: true };
  }
  return { approve: false, complete: false, reject: false, cancel: false };
}

export type RefundMutationClientError =
  | "REFUND_NOT_FOUND"
  | "REFUND_OVER_CAP"
  | "REFUND_PAYMENT_NOT_PAID"
  | "REFUND_NOT_TRANSITIONABLE"
  | "REFUND_REASON_INVALID"
  | "REFUND_INVALID_AMOUNT"
  | "REFUND_SOURCE_INVALID"
  | "REFUND_MUTATION_FAILED";

export function mapRefundMutationHttpError(
  status: number,
  raw: unknown
): RefundMutationClientError {
  const body =
    raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const code =
    typeof body.code === "string"
      ? body.code
      : typeof body.error === "string"
        ? body.error
        : "";
  if (status === 404 || code === "REFUND_NOT_FOUND" || code === "FINANCE_PAYMENT_NOT_FOUND") {
    return "REFUND_NOT_FOUND";
  }
  if (code === "REFUND_OVER_CAP") return "REFUND_OVER_CAP";
  if (code === "REFUND_PAYMENT_NOT_PAID" || code === "REFUND_PAYMENT_NOT_MANUAL") {
    return "REFUND_PAYMENT_NOT_PAID";
  }
  if (code === "REFUND_NOT_TRANSITIONABLE") return "REFUND_NOT_TRANSITIONABLE";
  if (code === "REFUND_REASON_INVALID") return "REFUND_REASON_INVALID";
  if (code === "REFUND_INVALID_AMOUNT") return "REFUND_INVALID_AMOUNT";
  if (code === "REFUND_SOURCE_INVALID" || code === "REFUND_CURRENCY_MISMATCH") {
    return "REFUND_SOURCE_INVALID";
  }
  return "REFUND_MUTATION_FAILED";
}

export function refundStatusI18nKey(status: RefundStatus): string {
  return `status${status}`;
}

export function refundSourceI18nKey(source: RefundSourceKind): string {
  return source === "payment" ? "sourcePayment" : "sourcePrepayment";
}

/** Guard: UI modules must not compute wallet nets client-side. */
export function financeRefundsLogicForbidsClientMoneyMath(source: string): boolean {
  // Build needles without embedding contiguous forbidden identifiers in this file.
  const walletNeedle = ["wallet", "Net"].join("");
  const remainingNeedle = ["refundable", "Remaining"].join("");
  const paidMinus = new RegExp(["paidPaymentsMinor", String.raw`\s*-`].join(""), "m");
  const bigintRefund = new RegExp(["BigInt\\(", ".*", "refund"].join(""), "m");
  return (
    !source.includes(walletNeedle) &&
    !source.includes(remainingNeedle) &&
    !paidMinus.test(source) &&
    !bigintRefund.test(source)
  );
}
