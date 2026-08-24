/** DP1 — format UTC paymentDueAt for locale display without recomputing policy hours. */
export function formatPaymentDueAtForMemberLocale(paymentDueAt: string, locale = "fa-IR"): string {
  const instant = Date.parse(paymentDueAt);
  if (!Number.isFinite(instant)) {
    return paymentDueAt;
  }
  return new Date(instant).toLocaleString(locale, { timeZone: "UTC" });
}
