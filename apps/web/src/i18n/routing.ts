import { defineRouting } from "next-intl/routing";

/**
 * Operator panel — no `/fa` URL prefix (B2B tenant hosts).
 * Legacy parity: `legacy/apps/web/src/i18n/routing.ts`
 */
export const routing = defineRouting({
  locales: ["fa", "en"],
  defaultLocale: "fa",
  localePrefix: "never",
});

export type AppLocale = (typeof routing.locales)[number];

export const RTL_LOCALES: readonly AppLocale[] = ["fa"];

export function isAppLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value);
}

export function resolveTextDirection(locale: AppLocale): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}
