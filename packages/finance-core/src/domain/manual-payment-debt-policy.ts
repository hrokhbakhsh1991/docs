/**
 * Manual debt gate — settlement vs partial collection (PR20-D).
 * @see docs/phase-20/p7/appendices/FINANCE_MANUAL_DEBT_PARTIAL_COLLECTION_POLICY.md
 */

function parseMinorDigits(value: string): bigint {
  return BigInt(value.replace(/\D/g, "") || "0");
}

export type ManualPaymentDebtGateInput = {
  readonly statuses: readonly string[];
  /** Compiled invoice remaining (`balanceDueMinor`). */
  readonly balanceDueMinor: string;
};

/**
 * Allow additional manual Pending debt while invoice remaining &gt; 0.
 * Forbid parallel Pending intents and any new debt after settlement (remaining = 0).
 */
export function assertManualPaymentDebtAllowed(input: ManualPaymentDebtGateInput): void {
  if (input.statuses.some((status) => status === "Pending")) {
    throw new Error(
      "ZOD_VALIDATION_FAILED: pending payment already exists for registration"
    );
  }

  const remaining = parseMinorDigits(input.balanceDueMinor);
  if (remaining > BigInt(0)) {
    return;
  }

  if (input.statuses.some((status) => status === "Paid")) {
    throw new Error(
      "ZOD_VALIDATION_FAILED: registration already has a successful payment; additional manual debt is not allowed"
    );
  }

  throw new Error(
    "ZOD_VALIDATION_FAILED: registration has no remaining balance; additional manual debt is not allowed"
  );
}

/**
 * True when amountMinor exceeds remaining + tolerance (obligation overpay / remainder overshoot).
 */
export function isManualPaymentAmountOverRemaining(input: {
  readonly amountMinor: string;
  readonly balanceDueMinor: string;
  readonly toleranceMinor: string;
}): boolean {
  const maxAllowed =
    parseMinorDigits(input.balanceDueMinor) + parseMinorDigits(input.toleranceMinor);
  return parseMinorDigits(input.amountMinor) > maxAllowed;
}
