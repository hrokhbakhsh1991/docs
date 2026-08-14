/**
 * SoT booking projection after receipt approve — balanceDueMinor → partial | paid.
 * Not a Case reading helper; do not use from finance-core Case interpreters.
 */
export function bookingPaymentStatusFromBalanceDue(
  balanceDueMinor: string
): "partial" | "paid" {
  const digits = balanceDueMinor.replace(/\D/g, "");
  if (digits.length === 0) {
    return "paid";
  }
  try {
    return BigInt(digits) > BigInt(0) ? "partial" : "paid";
  } catch {
    return "paid";
  }
}
