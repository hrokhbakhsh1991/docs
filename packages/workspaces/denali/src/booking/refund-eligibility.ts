/**
 * DEN-PROD-10 — Denali refund eligibility (policy layer, not Finance cap).
 * Finance enforces collected − completed refunds; this module applies penalty policy.
 */

function parseMinorDigits(value: string): bigint {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    return BigInt(0);
  }
  return BigInt(digits);
}

function formatMinorDigits(value: bigint): string {
  return value <= BigInt(0) ? "0" : value.toString();
}

export type ComputeDenaliRefundEligibilityInput = {
  /** Paid manual payments + prepayment (Finance facts). */
  readonly collectedMinor: string;
  /** Sum of Completed refunds (Finance facts). */
  readonly refundedCompletedMinor: string;
  readonly cancellationPenaltyPercentage?: number | null;
  /** When false, full collected minus prior refunds (subject to Finance cap). */
  readonly applyPenalty: boolean;
};

export type DenaliRefundEligibility = {
  readonly financeCapMinor: string;
  readonly penaltyMinor: string;
  readonly eligibleRefundMinor: string;
};

/** Suggested refund before Finance request; orchestrator uses min(eligible, cap). */
export function computeDenaliRefundEligibility(
  input: ComputeDenaliRefundEligibilityInput
): DenaliRefundEligibility {
  const collected = parseMinorDigits(input.collectedMinor);
  const refunded = parseMinorDigits(input.refundedCompletedMinor);
  const financeCap = collected > refunded ? collected - refunded : BigInt(0);

  let penalty = BigInt(0);
  if (
    input.applyPenalty &&
    input.cancellationPenaltyPercentage !== null &&
    input.cancellationPenaltyPercentage !== undefined &&
    input.cancellationPenaltyPercentage > 0
  ) {
    const pct = BigInt(Math.trunc(input.cancellationPenaltyPercentage));
    penalty = (collected * pct) / BigInt(100);
  }

  const afterPenalty =
    collected > penalty + refunded ? collected - penalty - refunded : BigInt(0);
  const eligibleRefund = afterPenalty < financeCap ? afterPenalty : financeCap;

  return {
    financeCapMinor: formatMinorDigits(financeCap),
    penaltyMinor: formatMinorDigits(penalty),
    eligibleRefundMinor: formatMinorDigits(eligibleRefund),
  };
}
