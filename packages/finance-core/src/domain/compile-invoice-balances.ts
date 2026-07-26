export type RegistrationInvoiceReadModel = {
  readonly registrationId: string;
  readonly currency: string;
  readonly invoiceTotalMinor: string;
  readonly paidAmountMinor: string;
  readonly balanceDueMinor: string;
  readonly walletNetMinor: string;
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
  const walletHint =
    sumMinorStrings([input.prepaymentMinor]) + sumMinorStrings([input.paidPaymentsMinor]);
  return walletHint;
}

export function compileRegistrationInvoice(
  input: CompileInvoiceBalancesInput
): RegistrationInvoiceReadModel {
  const walletNet =
    sumMinorStrings([input.prepaymentMinor]) + sumMinorStrings([input.paidPaymentsMinor]);
  const invoiceTotal = deriveInvoiceTotalMinor(input);
  const paid = walletNet > invoiceTotal ? invoiceTotal : walletNet;
  const balance = invoiceTotal > paid ? invoiceTotal - paid : BigInt(0);

  return {
    registrationId: input.registrationId,
    currency: input.currency.toUpperCase(),
    invoiceTotalMinor: invoiceTotal.toString(),
    paidAmountMinor: paid.toString(),
    balanceDueMinor: balance.toString(),
    walletNetMinor: walletNet.toString(),
  };
}
