/**
 * Pending manual payment cancel — reason validation (PR23-A.2).
 * @see docs/phase-20/p7/appendices/FINANCE_PENDING_MANUAL_PAYMENT_CANCEL_PR23_A2.md
 */

export const MANUAL_PAYMENT_CANCEL_REASON_CODES = [
  "abandoned",
  "wrong_amount",
  "superseded",
  "other",
] as const;

export type ManualPaymentCancelReasonCode =
  (typeof MANUAL_PAYMENT_CANCEL_REASON_CODES)[number];

export type CancelPendingManualPaymentReasonInput = {
  readonly reasonCode: string;
  readonly reasonNote?: string | null;
};

export type ValidatedCancelPendingManualPaymentReason = {
  readonly reasonCode: ManualPaymentCancelReasonCode;
  readonly reasonNote: string | null;
};

function isReasonCode(value: string): value is ManualPaymentCancelReasonCode {
  return (MANUAL_PAYMENT_CANCEL_REASON_CODES as readonly string[]).includes(value);
}

/**
 * Validate operator cancel reason. Throws `PAYMENT_CANCEL_REASON_INVALID`.
 */
export function assertCancelPendingManualPaymentReason(
  input: CancelPendingManualPaymentReasonInput
): ValidatedCancelPendingManualPaymentReason {
  if (!isReasonCode(input.reasonCode)) {
    throw new Error("PAYMENT_CANCEL_REASON_INVALID");
  }
  const trimmedNote =
    typeof input.reasonNote === "string" ? input.reasonNote.trim() : "";
  if (input.reasonCode === "other" && trimmedNote.length === 0) {
    throw new Error("PAYMENT_CANCEL_REASON_INVALID");
  }
  return {
    reasonCode: input.reasonCode,
    reasonNote: trimmedNote.length > 0 ? trimmedNote : null,
  };
}
