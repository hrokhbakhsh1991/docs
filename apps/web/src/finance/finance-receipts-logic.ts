import type { FinanceRegistrationContext } from "@/finance/finance-registration-context";
import { parseFinanceRegistrationContext } from "@/finance/finance-registration-context";

export const FINANCE_RECEIPTS_TEST_IDS = {
  panel: "finance-receipts-panel",
  list: "finance-receipts-list",
  loading: "finance-receipts-loading",
  empty: "finance-receipts-empty",
  emptyOpenPayments: "finance-receipts-empty-open-payments",
  reviewForm: "finance-receipt-review-form",
  preview: "finance-receipt-preview",
  submittedAt: "finance-receipt-submitted-at",
  openProof: "finance-receipt-open-proof",
  submittedAmount: "finance-receipt-submitted-amount",
  financialContext: "finance-receipt-financial-context",
  amountFit: "finance-receipt-amount-fit",
  approveConsequence: "finance-receipt-approve-consequence",
  paymentStatus: "finance-receipt-payment-status",
  /** PR21-H2 — receipt review status badge (not payment pending). */
  receiptStatus: "finance-receipt-status",
  reviewResult: "finance-receipt-review-result",
  /** PR22-D — after reject, link to Payments for related registration (no new fetch). */
  reviewResultOpenPayment: "finance-receipt-review-result-open-payment",
  primaryPathHint: "finance-receipts-primary-path-hint",
  proofToggle: "finance-receipt-proof-toggle",
  afterApprovePreview: "finance-receipt-after-approve-preview",
  /** PR23-B1 — queue clarity (presentation only). */
  fifoHint: "finance-receipts-fifo-hint",
  queueHonesty: "finance-receipts-queue-honesty",
  queueMayMore: "finance-receipts-queue-may-more",
  agingBand: "finance-receipt-aging-band",
  waitRelative: "finance-receipt-wait-relative",
  /** PR23-B2 — cursor pagination */
  loadMore: "finance-receipts-load-more",
} as const;

/**
 * Matches client fetch `?limit=50` on the receipts panel.
 * Presentation honesty only — not an API contract change.
 */
export const RECEIPT_QUEUE_FETCH_LIMIT = 50;

/** UX knobs only — not SLA / overdue / escalation (see PR23-B1 doc). */
export const RECEIPT_AGING_FRESH_MS = 4 * 60 * 60 * 1000;
export const RECEIPT_AGING_WAITING_MS = 48 * 60 * 60 * 1000;

export type ReceiptAgingBand = "fresh" | "waiting" | "longer";

export type ReceiptWaitRelativeUnit = "second" | "minute" | "hour" | "day";

/** Negative `value` = past (Intl.RelativeTimeFormat convention). */
export type ReceiptWaitRelative = {
  readonly value: number;
  readonly unit: ReceiptWaitRelativeUnit;
};

export type ReceiptQueueHonesty =
  | { readonly kind: "shown_only"; readonly shown: number }
  | { readonly kind: "shown_of_total"; readonly shown: number; readonly total: number }
  | { readonly kind: "shown_may_more"; readonly shown: number };

/**
 * Age in ms from `createdAt` to injectable `now`.
 * Returns null when `createdAt` is invalid. Does not call Date.now.
 */
export function receiptAgeMs(createdAtIso: string, now: Date): number | null {
  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime()) || Number.isNaN(now.getTime())) {
    return null;
  }
  return Math.max(0, now.getTime() - created.getTime());
}

/**
 * Soft aging band — presentation hint only. Not SLA.
 */
export function resolveReceiptAgingBand(ageMs: number): ReceiptAgingBand {
  if (ageMs < RECEIPT_AGING_FRESH_MS) {
    return "fresh";
  }
  if (ageMs < RECEIPT_AGING_WAITING_MS) {
    return "waiting";
  }
  return "longer";
}

export function resolveReceiptAgingBandFromCreatedAt(
  createdAtIso: string,
  now: Date
): ReceiptAgingBand | null {
  const age = receiptAgeMs(createdAtIso, now);
  if (age === null) {
    return null;
  }
  return resolveReceiptAgingBand(age);
}

/**
 * Relative wait parts for Intl.RelativeTimeFormat. Pure; no Date.now.
 */
export function resolveReceiptWaitRelative(
  createdAtIso: string,
  now: Date
): ReceiptWaitRelative | null {
  const age = receiptAgeMs(createdAtIso, now);
  if (age === null) {
    return null;
  }
  const sec = Math.floor(age / 1000);
  if (sec < 60) {
    return { value: -Math.max(sec, 0), unit: "second" };
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return { value: -min, unit: "minute" };
  }
  const hour = Math.floor(min / 60);
  if (hour < 48) {
    return { value: -hour, unit: "hour" };
  }
  const day = Math.floor(hour / 24);
  return { value: -Math.max(day, 1), unit: "day" };
}

/**
 * Queue honesty meta — never invents a total.
 * `pendingTotal` only when already supplied by the caller (no fetch here).
 */
export function resolveReceiptQueueHonesty(input: {
  readonly shown: number;
  readonly pendingTotal?: number;
  readonly fetchLimit?: number;
  /** When API reports hasMore — honesty without inventing a total. */
  readonly forceMayMore?: boolean;
}): ReceiptQueueHonesty {
  const shown = Math.max(0, input.shown);
  const fetchLimit = input.fetchLimit ?? RECEIPT_QUEUE_FETCH_LIMIT;
  const total = input.pendingTotal;
  if (typeof total === "number" && Number.isFinite(total) && total >= shown) {
    return { kind: "shown_of_total", shown, total: Math.floor(total) };
  }
  if (shown > 0 && (input.forceMayMore === true || shown >= fetchLimit)) {
    return { kind: "shown_may_more", shown };
  }
  return { kind: "shown_only", shown };
}

/** Presentation-only: compare payment amount to invoice remaining (SoT still authorizes). */
export type ReceiptAmountFit = "under" | "exact" | "over" | "unknown";

export function classifyReceiptAmountAgainstRemaining(
  paymentAmountMinor: string,
  balanceDueMinor: string | null | undefined
): ReceiptAmountFit {
  const amount = parseMinorBigInt(paymentAmountMinor);
  const due = parseMinorBigInt(balanceDueMinor);
  if (amount === null || due === null) {
    return "unknown";
  }
  if (amount < due) {
    return "under";
  }
  if (amount === due) {
    return "exact";
  }
  return "over";
}

/** Remaining after a successful underpay/exact approve (presentation math only). */
export function remainingAfterApproveMinor(
  paymentAmountMinor: string,
  balanceDueMinor: string
): string | null {
  const amount = parseMinorBigInt(paymentAmountMinor);
  const due = parseMinorBigInt(balanceDueMinor);
  if (amount === null || due === null || amount > due) {
    return null;
  }
  return (due - amount).toString();
}

function parseMinorBigInt(raw: string | null | undefined): bigint | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

export type FinanceReceiptPayment = {
  readonly id: string;
  readonly registrationId: string;
  readonly amount: string;
  readonly currency: string;
  readonly method: string;
  readonly status: string;
};

export type FinancePendingReceipt = {
  readonly id: string;
  readonly paymentId: string;
  readonly fileKey: string;
  readonly status: string;
  readonly note: string | null;
  readonly createdAt: string;
  readonly payment: FinanceReceiptPayment | null;
  readonly registrationContext: FinanceRegistrationContext | null;
};

export type FinancePendingReceiptsResponse = {
  readonly items: readonly FinancePendingReceipt[];
  /** PR23-B2 — opaque keyset cursor; null when no further page. */
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export type ReviewReceiptFormState = {
  readonly decision: "approve" | "reject";
  readonly reviewNote: string;
};

export function parseFinancePendingReceiptsResponse(raw: unknown): FinancePendingReceiptsResponse {
  if (raw === null || typeof raw !== "object") {
    return { items: [], nextCursor: null, hasMore: false };
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    return { items: [], nextCursor: null, hasMore: false };
  }
  const items = record.items
    .filter(
      (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null
    )
    .map((entry) => {
      const paymentRaw = entry.payment;
      const payment =
        typeof paymentRaw === "object" && paymentRaw !== null
          ? {
              id: String((paymentRaw as Record<string, unknown>).id ?? ""),
              registrationId: String((paymentRaw as Record<string, unknown>).registrationId ?? ""),
              amount: String((paymentRaw as Record<string, unknown>).amount ?? "0"),
              currency: String((paymentRaw as Record<string, unknown>).currency ?? ""),
              method: String((paymentRaw as Record<string, unknown>).method ?? "Manual"),
              status: String((paymentRaw as Record<string, unknown>).status ?? ""),
            }
          : null;
      return {
        id: String(entry.id ?? ""),
        paymentId: String(entry.paymentId ?? ""),
        fileKey: String(entry.fileKey ?? ""),
        status: String(entry.status ?? ""),
        note: typeof entry.note === "string" ? entry.note : null,
        createdAt: String(entry.createdAt ?? ""),
        payment,
        registrationContext: parseFinanceRegistrationContext(entry.registrationContext),
      };
    })
    .filter((entry) => entry.id.length > 0);
  const nextCursor =
    typeof record.nextCursor === "string" && record.nextCursor.trim().length > 0
      ? record.nextCursor.trim()
      : null;
  const hasMore =
    record.hasMore === true ? true : record.hasMore === false ? false : nextCursor !== null;
  return { items, nextCursor, hasMore };
}

export function validateReviewReceiptForm(
  input: ReviewReceiptFormState
): { ok: true; value: ReviewReceiptFormState } | { ok: false; error: string } {
  const reviewNote = input.reviewNote.trim();
  if (reviewNote.length > 2000) {
    return { ok: false, error: "REVIEW_NOTE_MAX" };
  }
  if (input.decision !== "approve" && input.decision !== "reject") {
    return { ok: false, error: "DECISION_INVALID" };
  }
  return {
    ok: true,
    value: {
      decision: input.decision,
      reviewNote,
    },
  };
}

export function buildReviewReceiptRequestBody(
  value: ReviewReceiptFormState
): Record<string, unknown> {
  return {
    decision: value.decision,
    ...(value.reviewNote.length > 0 ? { reviewNote: value.reviewNote } : {}),
  };
}

export type FinanceReceiptReviewResponse = {
  readonly id: string;
  readonly status: string;
  readonly reviewNote: string | null;
  readonly reviewedAt: string | null;
  readonly ledgerJournalId?: string;
  /** Present after successful approve — booking projection result. */
  readonly bookingPaymentStatus?: "unpaid" | "partial" | "paid";
};

export function parseFinanceReceiptReviewResponse(
  raw: unknown
): FinanceReceiptReviewResponse | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const status = typeof record.status === "string" ? record.status : "";
  if (id.length === 0 || status.length === 0) {
    return null;
  }
  const bookingRaw = record.bookingPaymentStatus;
  const bookingPaymentStatus =
    bookingRaw === "unpaid" || bookingRaw === "partial" || bookingRaw === "paid"
      ? bookingRaw
      : undefined;
  return {
    id,
    status,
    reviewNote: typeof record.reviewNote === "string" ? record.reviewNote : null,
    reviewedAt: typeof record.reviewedAt === "string" ? record.reviewedAt : null,
    ...(typeof record.ledgerJournalId === "string"
      ? { ledgerJournalId: record.ledgerJournalId }
      : {}),
    ...(bookingPaymentStatus !== undefined ? { bookingPaymentStatus } : {}),
  };
}

export function receiptFileLabel(fileKey: string): string {
  const segments = fileKey.split("/");
  const last = segments[segments.length - 1];
  return last && last.length > 0 ? last : fileKey;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const PDF_EXT = /\.pdf$/i;

export function isReceiptImageFileKey(fileKey: string): boolean {
  return IMAGE_EXT.test(receiptFileLabel(fileKey));
}

export function isReceiptPdfFileKey(fileKey: string): boolean {
  return PDF_EXT.test(receiptFileLabel(fileKey));
}

/** Browser can load absolute http(s) or same-origin /api proof proxies. */
export function isBrowserReachableReceiptUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/api/finance/receipts/");
}

export type FinanceReceiptUrlPayload = {
  readonly receiptId: string;
  readonly fileKey: string;
  readonly url: string;
};

export function parseFinanceReceiptUrlPayload(raw: unknown): FinanceReceiptUrlPayload | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const receiptId = typeof record.receiptId === "string" ? record.receiptId : "";
  const fileKey = typeof record.fileKey === "string" ? record.fileKey : "";
  const url = typeof record.url === "string" ? record.url : "";
  if (receiptId.length === 0 || fileKey.length === 0 || url.length === 0) {
    return null;
  }
  return { receiptId, fileKey, url };
}
