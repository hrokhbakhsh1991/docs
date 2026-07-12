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

/** Cross-surface egress (portal base URLs) must not receive locale path prefix (GX-1). */
export function isMarketingLocaleExternalPath(path: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(path.trim());
}

export function resolveMarketingLocalePath(path: string, locale: AppLocale): string {
  const trimmed = path.trim();
  if (isMarketingLocaleExternalPath(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutLocale = normalized.replace(/^\/en(?=\/|$)/, "") || "/";
  if (locale === routing.defaultLocale) {
    return withoutLocale;
  }
  return withoutLocale === "/" ? `/${locale}` : `/${locale}${withoutLocale}`;
}

/** Locale-aware `/tours` list path with optional query string (M9). */
export function resolveMarketingToursListPath(
  locale: AppLocale,
  searchParams?: URLSearchParams | Readonly<Record<string, string>>
): string {
  let suffix = "";
  if (searchParams !== undefined) {
    const params =
      searchParams instanceof URLSearchParams
        ? searchParams
        : new URLSearchParams(searchParams);
    if (params.size > 0) {
      suffix = `?${params.toString()}`;
    }
  }
  return resolveMarketingLocalePath(`/tours${suffix}`, locale);
}

/** Locale-aware tour detail path `/tours/{id}` (M9). */
export function resolveMarketingTourDetailPath(tourId: string, locale: AppLocale): string {
  return resolveMarketingLocalePath(`/tours/${tourId}`, locale);
}
