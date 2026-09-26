/** Format stored minor amounts using the member-facing currency convention. */
export function formatMemberMoney(amountMinor: string, currency: string): string {
  const digits = amountMinor.replace(/\D/g, "");
  const amount = digits.length > 0 ? Number.parseInt(digits, 10) : NaN;
  if (!Number.isFinite(amount)) {
    return amountMinor;
  }
  const formatted = amount.toLocaleString("fa-IR");
  return currency.toUpperCase() === "IRR" ? `${formatted} تومان` : `${formatted} ${currency}`;
}
