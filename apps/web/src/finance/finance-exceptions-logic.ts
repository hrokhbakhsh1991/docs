/**
 * PR23-C3 — finance exception operator UI (presentation helpers only).
 * Exception detection stays on the API; this module parses and displays.
 */

import type { FinanceRegistrationContext } from "@/finance/finance-registration-context";

export const FINANCE_EXCEPTIONS_TEST_IDS = {
  panel: "finance-exceptions-panel",
  list: "finance-exceptions-list",
  loading: "finance-exceptions-loading",
  empty: "finance-exceptions-empty",
  error: "finance-exceptions-error",
  retry: "finance-exceptions-retry",
  item: "finance-exception-item",
  type: "finance-exception-type",
  meaning: "finance-exception-meaning",
  reason: "finance-exception-reason",
  balance: "finance-exception-balance",
  occurredAt: "finance-exception-occurred-at",
  openPayments: "finance-exception-open-payments",
  openReceipts: "finance-exception-open-receipts",
  openOutstanding: "finance-exception-open-outstanding",
  refresh: "finance-exceptions-refresh",
} as const;

/** Mirror of API exception types — display vocabulary only, not detection rules. */
export const FINANCE_EXCEPTION_TYPE = {
  REJECTED_RECEIPT_PENDING_PAYMENT: "REJECTED_RECEIPT_PENDING_PAYMENT",
  CANCELLED_PAYMENT_WITH_BALANCE: "CANCELLED_PAYMENT_WITH_BALANCE",
} as const;

export type FinanceExceptionType =
  (typeof FINANCE_EXCEPTION_TYPE)[keyof typeof FINANCE_EXCEPTION_TYPE];

export type FinanceExceptionListItem = {
  readonly id: string;
  readonly type: FinanceExceptionType;
  readonly registrationId: string;
  readonly identity: {
    readonly memberDisplayName: string | null;
    readonly tourTitle: string | null;
    readonly tourId: string | null;
  };
  readonly payment: {
    readonly id: string;
    readonly status: "Pending" | "Cancelled";
    readonly amount: string;
    readonly currency: string;
    readonly method: string;
  };
  readonly reason: string | null;
  readonly balanceDueMinor: string | null;
  readonly href: {
    readonly payments: string;
    readonly receipts?: string;
  };
  readonly occurredAt: string;
};

export type FinanceExceptionsPage = {
  readonly items: readonly FinanceExceptionListItem[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export function isFinanceExceptionType(value: unknown): value is FinanceExceptionType {
  return (
    value === FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT ||
    value === FINANCE_EXCEPTION_TYPE.CANCELLED_PAYMENT_WITH_BALANCE
  );
}

function parsePaymentStatus(raw: unknown): "Pending" | "Cancelled" | null {
  if (raw === "Pending" || raw === "Cancelled") {
    return raw;
  }
  return null;
}

/**
 * Accept only in-app finance navigation hrefs from the API (no open redirects).
 */
export function sanitizeFinanceExceptionHref(raw: unknown): string | null {
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

function parseExceptionItem(raw: unknown): FinanceExceptionListItem | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (!isFinanceExceptionType(record.type)) {
    return null;
  }
  const id = String(record.id ?? "").trim();
  const registrationId = String(record.registrationId ?? "").trim();
  if (id.length === 0 || registrationId.length === 0) {
    return null;
  }
  const paymentRaw =
    record.payment !== null && typeof record.payment === "object"
      ? (record.payment as Record<string, unknown>)
      : null;
  if (paymentRaw === null) {
    return null;
  }
  const paymentStatus = parsePaymentStatus(paymentRaw.status);
  const paymentId = String(paymentRaw.id ?? "").trim();
  if (paymentStatus === null || paymentId.length === 0) {
    return null;
  }
  const hrefRaw =
    record.href !== null && typeof record.href === "object"
      ? (record.href as Record<string, unknown>)
      : null;
  const paymentsHref = sanitizeFinanceExceptionHref(hrefRaw?.payments);
  if (paymentsHref === null) {
    return null;
  }
  const receiptsHref = sanitizeFinanceExceptionHref(hrefRaw?.receipts);

  const identityRaw =
    record.identity !== null && typeof record.identity === "object"
      ? (record.identity as Record<string, unknown>)
      : {};
  const memberDisplayName =
    typeof identityRaw.memberDisplayName === "string" &&
    identityRaw.memberDisplayName.trim().length > 0
      ? identityRaw.memberDisplayName.trim()
      : null;
  const tourTitle =
    typeof identityRaw.tourTitle === "string" && identityRaw.tourTitle.trim().length > 0
      ? identityRaw.tourTitle.trim()
      : null;
  const tourId =
    typeof identityRaw.tourId === "string" && identityRaw.tourId.trim().length > 0
      ? identityRaw.tourId.trim()
      : null;

  const reason =
    typeof record.reason === "string" && record.reason.trim().length > 0
      ? record.reason.trim()
      : null;
  const balanceDueMinor =
    typeof record.balanceDueMinor === "string" && record.balanceDueMinor.trim().length > 0
      ? record.balanceDueMinor.trim()
      : null;
  const occurredAt =
    typeof record.occurredAt === "string" && record.occurredAt.trim().length > 0
      ? record.occurredAt.trim()
      : "";

  return {
    id,
    type: record.type,
    registrationId,
    identity: { memberDisplayName, tourTitle, tourId },
    payment: {
      id: paymentId,
      status: paymentStatus,
      amount: String(paymentRaw.amount ?? ""),
      currency: String(paymentRaw.currency ?? ""),
      method: String(paymentRaw.method ?? "Manual"),
    },
    reason,
    balanceDueMinor,
    href: {
      payments: paymentsHref,
      ...(receiptsHref !== null ? { receipts: receiptsHref } : {}),
    },
    occurredAt,
  };
}

/**
 * Parse exception list response. Preserves API order — does not sort or filter by rule.
 */
export function parseFinanceExceptionsResponse(raw: unknown): FinanceExceptionsPage {
  if (raw === null || typeof raw !== "object") {
    return { items: [], nextCursor: null, hasMore: false };
  }
  const record = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(record.items) ? record.items : [];
  const items: FinanceExceptionListItem[] = [];
  for (const row of itemsRaw) {
    const parsed = parseExceptionItem(row);
    if (parsed !== null) {
      items.push(parsed);
    }
  }
  const nextCursor =
    typeof record.nextCursor === "string" && record.nextCursor.trim().length > 0
      ? record.nextCursor.trim()
      : null;
  return {
    items,
    nextCursor,
    hasMore: record.hasMore === true,
  };
}

/** Map API identity into registration context when all display fields are present. */
export function toExceptionRegistrationContext(
  item: FinanceExceptionListItem
): FinanceRegistrationContext | null {
  const member = item.identity.memberDisplayName?.trim() ?? "";
  const tourTitle = item.identity.tourTitle?.trim() ?? "";
  const tourId = item.identity.tourId?.trim() ?? "";
  if (member.length === 0 || tourTitle.length === 0 || tourId.length === 0) {
    return null;
  }
  return {
    registrationId: item.registrationId,
    tourId,
    tourTitle,
    memberDisplayName: member,
  };
}

export function exceptionTypeI18nKey(
  type: FinanceExceptionType
): "typeRejectedReceiptPending" | "typeCancelledWithBalance" {
  return type === FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT
    ? "typeRejectedReceiptPending"
    : "typeCancelledWithBalance";
}

export function exceptionMeaningI18nKey(
  type: FinanceExceptionType
): "meaningRejectedReceiptPending" | "meaningCancelledWithBalance" {
  return type === FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT
    ? "meaningRejectedReceiptPending"
    : "meaningCancelledWithBalance";
}

/** True when E1 secondary receipts href is present. */
export function hasExceptionReceiptsHref(item: FinanceExceptionListItem): boolean {
  return typeof item.href.receipts === "string" && item.href.receipts.startsWith("/finance");
}

/** Outstanding deep-link for cancelled-with-balance (and any registration-scoped follow-up). */
export function exceptionOutstandingHref(registrationId: string): string {
  return `/finance?tab=outstanding&registrationId=${encodeURIComponent(registrationId)}`;
}

/** Journey 10: cancelled payment with remaining balance should surface Money owed. */
export function exceptionShowsOutstandingLink(item: FinanceExceptionListItem): boolean {
  return item.type === FINANCE_EXCEPTION_TYPE.CANCELLED_PAYMENT_WITH_BALANCE;
}
