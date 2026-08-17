/**
 * OTP cell accessible index. FA must be Eastern Arabic-Indic (رقم ۱), not ASCII 1.
 */
export function formatOtpDigitIndex(index: number, locale: string): string {
  const intlLocale = locale === "fa" || locale.startsWith("fa-") ? "fa-IR" : "en-US";
  return new Intl.NumberFormat(intlLocale, { useGrouping: false }).format(index);
}
