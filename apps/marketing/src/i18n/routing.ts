import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fa", "en"],
  defaultLocale: "fa",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

export const RTL_LOCALES: readonly AppLocale[] = ["fa"];

export function isAppLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value);
}

export function resolveTextDirection(locale: AppLocale): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

export function resolveIntlDateLocale(locale: AppLocale): string {
  return locale === "fa" ? "fa-IR" : "en-US";
}

export function resolveMarketingLocalePath(path: string, locale: AppLocale): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const withoutLocale = normalized.replace(/^\/en(?=\/|$)/, "") || "/";
  if (locale === routing.defaultLocale) {
    return withoutLocale;
  }
  return withoutLocale === "/" ? `/${locale}` : `/${locale}${withoutLocale}`;
}
