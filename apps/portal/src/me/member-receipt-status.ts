/** Shared member offline-receipt panel — safe for client + BFF (not a server-only module). */
export type MemberReceiptStatus = "none" | "pending" | "rejected" | "paid" | "waived";
export type MemberReceiptPreviewKind = "image" | "pdf" | "unknown";

export type MemberReceiptPanel = {
  readonly status: MemberReceiptStatus;
  readonly remainingMinor: string | null;
  readonly obligationMinor: string | null;
  readonly paidMinor: string | null;
  readonly currency: string | null;
  readonly previewUrl: string | null;
  readonly previewKind: MemberReceiptPreviewKind | null;
};

const EMPTY_PANEL: MemberReceiptPanel = {
  status: "none",
  remainingMinor: null,
  obligationMinor: null,
  paidMinor: null,
  currency: null,
  previewUrl: null,
  previewKind: null,
};

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

function parseMinor(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function parseMemberReceiptPanel(payload: unknown): MemberReceiptPanel {
  if (payload === null || typeof payload !== "object") {
    return EMPTY_PANEL;
  }
  const rec = payload as Record<string, unknown>;
  const previewKind = parsePreviewKind(rec.previewKind);
  const previewUrl = parseMinor(rec.previewUrl);
  return {
    status: parseMemberReceiptStatus(rec.status),
    remainingMinor: parseMinor(rec.remainingMinor),
    obligationMinor: parseMinor(rec.obligationMinor),
    paidMinor: parseMinor(rec.paidMinor),
    currency: parseMinor(rec.currency),
    previewUrl,
    previewKind: previewUrl !== null ? (previewKind ?? "unknown") : previewKind,
  };
}

export function emptyMemberReceiptPanel(): MemberReceiptPanel {
  return EMPTY_PANEL;
}
