export const FINANCE_RECEIPTS_TEST_IDS = {
  panel: "finance-receipts-panel",
  list: "finance-receipts-list",
  reviewForm: "finance-receipt-review-form",
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

export function receiptFileLabel(fileKey: string): string {
  const segments = fileKey.split("/");
  const last = segments[segments.length - 1];
  return last && last.length > 0 ? last : fileKey;
}
