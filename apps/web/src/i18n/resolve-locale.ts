import { cookies } from "next/headers";

import { isAppLocale, routing, type AppLocale } from "./routing";

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function resolveLocaleFromCookieValue(value: string | undefined): AppLocale | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }
  return isAppLocale(value) ? value : null;
}

/** Request locale: cookie override, else default `fa` (tenant-specific locale later). */
export async function resolveRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const fromCookie = resolveLocaleFromCookieValue(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  return fromCookie ?? routing.defaultLocale;
}
