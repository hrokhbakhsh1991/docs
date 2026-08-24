export type RegistrationInvoiceReadModel = {
  readonly registrationId: string;
  readonly currency: string;
  readonly invoiceTotalMinor: string;
  readonly paidAmountMinor: string;
  readonly balanceDueMinor: string;
  /** Alias of balanceDueMinor for member/operator surfaces and DP-1 tests. */
  readonly remainingMinor: string;
  readonly walletNetMinor: string;
  /** Sum of Completed refunds (PR23-E2); always present. */
  readonly refundedMinor: string;
};

export type CompileInvoiceBalancesInput = {
  readonly registrationId: string;
  readonly currency: string;
  readonly prepaymentMinor: string;
  readonly paidPaymentsMinor: string;
  readonly paymentAmountsMinor: readonly string[];
  readonly scheduleAmountsMinor: readonly string[];
  /** FC-2 — workspace obligation; after schedule, before payment-sum fallback. */
  readonly obligationMinor?: string;
  /** PR23-E2 — Completed refunds only; default 0. */
  readonly refundedCompletedMinor?: string;
};

function sumMinorStrings(values: readonly string[]): bigint {
  return values.reduce((acc, value) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) {
      return acc;
    }
    return acc + BigInt(digits);
  }, BigInt(0));
}

function deriveInvoiceTotalMinor(input: CompileInvoiceBalancesInput): bigint {
  const scheduleTotal = sumMinorStrings(input.scheduleAmountsMinor);
  if (scheduleTotal > BigInt(0)) {
    return scheduleTotal;
  }
  if (input.obligationMinor !== undefined) {
    const obligationTotal = sumMinorStrings([input.obligationMinor]);
    if (obligationTotal > BigInt(0)) {
      return obligationTotal;
    }
  }
  const paymentTotal = sumMinorStrings(input.paymentAmountsMinor);
  if (paymentTotal > BigInt(0)) {
    return paymentTotal;
  }
  const refunded = sumMinorStrings([input.refundedCompletedMinor ?? "0"]);
  const walletHint =
    sumMinorStrings([input.prepaymentMinor]) +
    sumMinorStrings([input.paidPaymentsMinor]) -
    refunded;
  return walletHint > BigInt(0) ? walletHint : BigInt(0);
}

export function compileRegistrationInvoice(
  input: CompileInvoiceBalancesInput
): RegistrationInvoiceReadModel {
  const refunded = sumMinorStrings([input.refundedCompletedMinor ?? "0"]);
  const walletGross =
    sumMinorStrings([input.prepaymentMinor]) + sumMinorStrings([input.paidPaymentsMinor]);
  const walletNetRaw = walletGross - refunded;
  const walletNet = walletNetRaw > BigInt(0) ? walletNetRaw : BigInt(0);
  const invoiceTotal = deriveInvoiceTotalMinor(input);
  const paid = walletNet > invoiceTotal ? invoiceTotal : walletNet;
  const balance = invoiceTotal > paid ? invoiceTotal - paid : BigInt(0);

  return {
    registrationId: input.registrationId,
    currency: input.currency.toUpperCase(),
    invoiceTotalMinor: invoiceTotal.toString(),
    paidAmountMinor: paid.toString(),
    balanceDueMinor: balance.toString(),
    remainingMinor: balance.toString(),
    walletNetMinor: walletNet.toString(),
    refundedMinor: refunded.toString(),
  };
}
