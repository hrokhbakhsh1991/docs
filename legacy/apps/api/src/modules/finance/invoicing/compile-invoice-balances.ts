export function computePaidAndBalanceDueMinor(
  invoiceTotalMinor: string,
  bookingWalletNetMinor: string
): { paidAmountMinor: string; balanceDueMinor: string } {
  const total = BigInt(invoiceTotalMinor.trim());
  let paid = BigInt(bookingWalletNetMinor.trim() || "0");
  if (paid < 0n) {
    paid = 0n;
  }
  if (paid > total) {
    paid = total;
  }
  const balanceDue = total > paid ? total - paid : 0n;
  return {
    paidAmountMinor: paid.toString(),
    balanceDueMinor: balanceDue.toString(),
  };
}
