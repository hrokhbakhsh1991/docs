/**
 * Refund aggregate types (PR23-E2).
 * @see docs/phase-20/p7/appendices/FINANCE_REFUND_DOMAIN_IMPLEMENTATION_PR23_E2.md
 */

export const REFUND_STATUSES = [
  "Requested",
  "Approved",
  "Rejected",
  "Completed",
  "Cancelled",
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_SOURCE_KINDS = ["payment", "prepayment"] as const;

export type RefundSourceKind = (typeof REFUND_SOURCE_KINDS)[number];

export const REFUND_REASON_CODES = [
  "member_withdrawal",
  "overpayment",
  "ops_correction",
  "other",
] as const;

export type RefundReasonCode = (typeof REFUND_REASON_CODES)[number];

export type FinanceRefundRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly paymentId: string | null;
  readonly sourceKind: RefundSourceKind;
  readonly amountMinor: string;
  readonly currency: string;
  readonly reasonCode: RefundReasonCode;
  readonly reasonNote: string | null;
  readonly status: RefundStatus;
  readonly requestedAt: Date;
  readonly requestedByUserId: string;
  readonly approvedAt: Date | null;
  readonly approvedByUserId: string | null;
  readonly rejectedAt: Date | null;
  readonly rejectedByUserId: string | null;
  readonly rejectNote: string | null;
  readonly cancelledAt: Date | null;
  readonly cancelledByUserId: string | null;
  readonly completedAt: Date | null;
  readonly completedByUserId: string | null;
  readonly completionNote: string | null;
  readonly evidenceFileKey: string | null;
  readonly evidenceNote: string | null;
  readonly creationIdempotencyKey: string | null;
};

export type RequestRefundReasonInput = {
  readonly reasonCode: string;
  readonly reasonNote?: string | null;
};

export type ValidatedRefundReason = {
  readonly reasonCode: RefundReasonCode;
  readonly reasonNote: string | null;
};

function isReasonCode(value: string): value is RefundReasonCode {
  return (REFUND_REASON_CODES as readonly string[]).includes(value);
}

/** Throws `REFUND_REASON_INVALID`. */
export function assertRefundReason(input: RequestRefundReasonInput): ValidatedRefundReason {
  if (!isReasonCode(input.reasonCode)) {
    throw new Error("REFUND_REASON_INVALID");
  }
  const trimmedNote =
    typeof input.reasonNote === "string" ? input.reasonNote.trim() : "";
  if (input.reasonCode === "other" && trimmedNote.length === 0) {
    throw new Error("REFUND_REASON_INVALID");
  }
  return {
    reasonCode: input.reasonCode,
    reasonNote: trimmedNote.length > 0 ? trimmedNote : null,
  };
}

/** Normalize positive minor amount; throws `REFUND_INVALID_AMOUNT`. */
export function assertPositiveRefundAmountMinor(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0 || BigInt(digits) <= BigInt(0)) {
    throw new Error("REFUND_INVALID_AMOUNT");
  }
  return digits;
}
