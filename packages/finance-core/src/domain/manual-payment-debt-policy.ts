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
  /**
   * Compiled invoice total. When remaining and total are both 0 and there is no
   * Paid row, the registration has no commercial invoice yet — first manual debt
   * may establish the amount (ops / cert bootstrap). Omit to keep legacy reject.
   */
  readonly invoiceTotalMinor?: string;
};

/**
 * Allow additional manual Pending debt while invoice remaining &gt; 0.
 * Forbid parallel Pending intents and any new debt after settlement (remaining = 0
 * with a known invoice / Paid row). Allow bootstrap when invoice total is still 0.
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

  const invoiceTotal =
    input.invoiceTotalMinor !== undefined
      ? parseMinorDigits(input.invoiceTotalMinor)
      : null;
  if (invoiceTotal !== null && invoiceTotal === BigInt(0)) {
    // No commercial invoice yet — first Pending debt establishes the amount.
    return;
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
