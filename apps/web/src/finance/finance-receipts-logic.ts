import type { FinanceRegistrationContext } from "@/finance/finance-registration-context";
import { parseFinanceRegistrationContext } from "@/finance/finance-registration-context";

export const FINANCE_RECEIPTS_TEST_IDS = {
  panel: "finance-receipts-panel",
  list: "finance-receipts-list",
  reviewForm: "finance-receipt-review-form",
  preview: "finance-receipt-preview",
  submittedAt: "finance-receipt-submitted-at",
  openProof: "finance-receipt-open-proof",
} as const;

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
};

export type ReviewReceiptFormState = {
  readonly decision: "approve" | "reject";
  readonly reviewNote: string;
};

export function parseFinancePendingReceiptsResponse(raw: unknown): FinancePendingReceiptsResponse {
  if (raw === null || typeof raw !== "object") {
    return { items: [] };
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    return { items: [] };
  }
  const items = record.items
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => {
      const paymentRaw = entry.payment;
      const payment =
        typeof paymentRaw === "object" && paymentRaw !== null
          ? {
              id: String((paymentRaw as Record<string, unknown>).id ?? ""),
              registrationId: String((paymentRaw as Record<string, unknown>).registrationId ?? ""),
              amount: String((paymentRaw as Record<string, unknown>).amount ?? "0"),
              currency: String((paymentRaw as Record<string, unknown>).currency ?? "IRR"),
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
  return { items };
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

export function parseFinanceReceiptReviewResponse(raw: unknown): FinanceReceiptReviewResponse | null {
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
