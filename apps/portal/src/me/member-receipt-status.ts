/** Shared member offline-receipt panel — safe for client + BFF (not a server-only module). */
export type MemberReceiptStatus = "none" | "pending" | "rejected" | "paid" | "waived";
export type MemberReceiptPreviewKind = "image" | "pdf" | "unknown";

export type MemberReceiptPanel = {
  readonly status: MemberReceiptStatus;
  readonly invoiceTotalMinor: string | null;
  readonly initialPaymentDueMinor: string | null;
  readonly amountDueNowMinor: string | null;
  readonly remainingMinor: string | null;
  readonly obligationMinor: string | null;
  readonly paidMinor: string | null;
  readonly currency: string | null;
  readonly previewUrl: string | null;
  readonly previewKind: MemberReceiptPreviewKind | null;
  readonly paymentDestination: MemberPaymentDestination | null;
};

export type MemberPaymentDestination = {
  readonly enabled: boolean;
  readonly revision: string;
  readonly cardNumber: string;
  readonly cardHolderName: string;
  readonly bankName: string | null;
  readonly instructions: string | null;
};

const EMPTY_PANEL: MemberReceiptPanel = Object.freeze({
  status: "none",
  invoiceTotalMinor: null,
  initialPaymentDueMinor: null,
  amountDueNowMinor: null,
  remainingMinor: null,
  obligationMinor: null,
  paidMinor: null,
  currency: null,
  previewUrl: null,
  previewKind: null,
  paymentDestination: null,
});

export function parseMemberReceiptStatus(value: unknown): MemberReceiptStatus {
  if (
    value === "pending" ||
    value === "rejected" ||
    value === "paid" ||
    value === "none" ||
    value === "waived"
  ) {
    return value;
  }
  return "none";
}

function parsePreviewKind(value: unknown): MemberReceiptPreviewKind | null {
  if (value === "image" || value === "pdf" || value === "unknown") {
    return value;
  }
  return null;
}

function parseNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function parseMemberReceiptPanel(payload: unknown): MemberReceiptPanel {
  if (payload === null || typeof payload !== "object") {
    return emptyMemberReceiptPanel();
  }
  const rec = payload as Record<string, unknown>;
  const previewKind = parsePreviewKind(rec.previewKind);
  const previewUrl = parseNonEmptyString(rec.previewUrl);
  const rawDestination = rec.paymentDestination;
  const paymentDestination =
    rawDestination !== null && typeof rawDestination === "object"
      ? (() => {
          const d = rawDestination as Record<string, unknown>;
          const revision = parseNonEmptyString(d.revision);
          const cardNumber = parseNonEmptyString(d.cardNumber);
          const cardHolderName = parseNonEmptyString(d.cardHolderName);
          return d.enabled === true && revision && cardNumber && cardHolderName
            ? {
                enabled: true,
                revision,
                cardNumber,
                cardHolderName,
                bankName: parseNonEmptyString(d.bankName),
                instructions: parseNonEmptyString(d.instructions),
              }
            : null;
        })()
      : null;
  return {
    status: parseMemberReceiptStatus(rec.status),
    invoiceTotalMinor: parseNonEmptyString(rec.invoiceTotalMinor),
    initialPaymentDueMinor: parseNonEmptyString(rec.initialPaymentDueMinor),
    amountDueNowMinor: parseNonEmptyString(rec.amountDueNowMinor),
    remainingMinor: parseNonEmptyString(rec.remainingMinor),
    obligationMinor: parseNonEmptyString(rec.obligationMinor),
    paidMinor: parseNonEmptyString(rec.paidMinor),
    currency: parseNonEmptyString(rec.currency),
    previewUrl,
    previewKind: previewUrl !== null ? (previewKind ?? "unknown") : previewKind,
    paymentDestination,
  };
}

export function emptyMemberReceiptPanel(): MemberReceiptPanel {
  return { ...EMPTY_PANEL };
}
