/**
 * Refundable caps (PR23-E2).
 * Cap = collected gross − Completed refunds; never invoice total / ledger / Pending.
 */

function toMinorDigits(value: string): bigint {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    return BigInt(0);
  }
  return BigInt(digits);
}

export type RegistrationRefundCapInput = {
  readonly paidPaymentsMinor: string;
  readonly prepaymentMinor: string;
  readonly refundedCompletedMinor: string;
};

export function registrationRefundableRemainingMinor(input: RegistrationRefundCapInput): bigint {
  const collected =
    toMinorDigits(input.paidPaymentsMinor) + toMinorDigits(input.prepaymentMinor);
  const refunded = toMinorDigits(input.refundedCompletedMinor);
  const remaining = collected - refunded;
  return remaining > BigInt(0) ? remaining : BigInt(0);
}

export type PaymentScopedRefundCapInput = RegistrationRefundCapInput & {
  readonly paymentAmountMinor: string;
  readonly paymentRefundedCompletedMinor: string;
};

export function paymentScopedRefundableCapMinor(input: PaymentScopedRefundCapInput): bigint {
  const registrationCap = registrationRefundableRemainingMinor(input);
  const paymentHeadroom =
    toMinorDigits(input.paymentAmountMinor) - toMinorDigits(input.paymentRefundedCompletedMinor);
  const paymentCap = paymentHeadroom > BigInt(0) ? paymentHeadroom : BigInt(0);
  return registrationCap < paymentCap ? registrationCap : paymentCap;
}

export type PrepaymentScopedRefundCapInput = RegistrationRefundCapInput & {
  readonly prepaymentRefundedCompletedMinor: string;
};

export function prepaymentScopedRefundableCapMinor(input: PrepaymentScopedRefundCapInput): bigint {
  const registrationCap = registrationRefundableRemainingMinor(input);
  const prepayHeadroom =
    toMinorDigits(input.prepaymentMinor) - toMinorDigits(input.prepaymentRefundedCompletedMinor);
  const prepayCap = prepayHeadroom > BigInt(0) ? prepayHeadroom : BigInt(0);
  return registrationCap < prepayCap ? registrationCap : prepayCap;
}

/** Throws `REFUND_OVER_CAP` when amount exceeds effective cap. */
export function assertRefundAmountWithinCap(amountMinor: string, effectiveCapMinor: bigint): void {
  const amount = toMinorDigits(amountMinor);
  if (amount > effectiveCapMinor) {
    throw new Error("REFUND_OVER_CAP");
  }
}
