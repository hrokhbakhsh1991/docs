/**
 * PR15-G — Host Case-read coherence: booking payment projection vs invoice remaining.
 * Fact ownership only — does not interpret Case readings or invent partial-scope.
 */

/**
 * True when booking claims `paid` but commercial invoice still has a positive balance.
 * Callers set `meaningConflictProven` — never fabricate `partialScopeDeclared`.
 */
export function isBookingPaidWithPositiveInvoiceRemaining(input: {
  readonly bookingPaymentStatus: string | null | undefined;
  readonly remainingMinor: string | null | undefined;
}): boolean {
  if (input.bookingPaymentStatus === null || input.bookingPaymentStatus === undefined) {
    return false;
  }
  if (input.bookingPaymentStatus.trim().toLowerCase() !== "paid") {
    return false;
  }
  if (input.remainingMinor === null || input.remainingMinor === undefined) {
    return false;
  }
  const digits = input.remainingMinor.replace(/\D/g, "");
  if (digits.length === 0) {
    return false;
  }
  try {
    return BigInt(digits) > BigInt(0);
  } catch {
    return false;
  }
}
