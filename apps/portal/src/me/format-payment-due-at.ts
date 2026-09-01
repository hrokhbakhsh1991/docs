import { INTL_LOCALE } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";

/** DP1 — format UTC paymentDueAt for locale display without recomputing policy hours. */
export function formatPaymentDueAtForMemberLocale(
  paymentDueAt: string,
  locale: AppLocale
): string {
  const instant = Date.parse(paymentDueAt);
  if (!Number.isFinite(instant)) {
    return paymentDueAt;
  }
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
    ...(locale === "fa" ? { numberingSystem: "arabext" } : {}),
  }).format(new Date(instant));
}
