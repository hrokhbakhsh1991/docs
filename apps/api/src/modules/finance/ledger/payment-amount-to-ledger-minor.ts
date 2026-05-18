/** Normalize `payments.amount` to a positive integer minor-unit string for ledger posting. */
export function paymentAmountToLedgerMinorString(amount: string): string {
  const normalized = amount.trim().replace(/,/g, "");
  if (/^\d+$/.test(normalized)) {
    const n = BigInt(normalized);
    if (n <= 0n) {
      throw new Error("LEDGER_PAYMENT_AMOUNT: payment.amount must be a positive integer minor string");
    }
    return n.toString();
  }
  const m = /^(\d+)\.(\d+)$/.exec(normalized);
  if (m) {
    const frac = m[2]!;
    if (!/^0+$/.test(frac)) {
      throw new Error(
        "LEDGER_PAYMENT_AMOUNT: fractional minor units are not supported for payment capture"
      );
    }
    const n = BigInt(m[1]!);
    if (n <= 0n) {
      throw new Error("LEDGER_PAYMENT_AMOUNT: payment.amount must be positive");
    }
    return n.toString();
  }
  throw new Error(`LEDGER_PAYMENT_AMOUNT: unsupported payment.amount format: ${amount}`);
}
