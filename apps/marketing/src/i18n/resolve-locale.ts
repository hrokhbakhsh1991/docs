import { cookies, headers } from "next/headers";

import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";

import { LOCALE_COOKIE_NAME } from "./locale-cookie";
import { resolveAppLocale } from "./resolve-app-locale";
import { isAppLocale, type AppLocale } from "./routing";

export { LOCALE_COOKIE_NAME } from "./locale-cookie";

export function resolveLocaleFromCookieValue(value: string | undefined): AppLocale | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }
  return isAppLocale(value) ? value : null;
}

export async function resolveRequestLocale(): Promise<AppLocale> {
  const headerList = await headers();
  const fromHeader = resolveLocaleFromCookieValue(headerList.get("x-marketing-locale") ?? undefined);
  if (fromHeader !== null) {
    return fromHeader;
  }

  const cookieStore = await cookies();
  const fromCookie = resolveLocaleFromCookieValue(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  if (fromCookie !== null) {
    return fromCookie;
  }

  const host = headerList.get("host")?.trim() ?? "";
  if (host.length > 0) {
    const branding = await fetchPublicTenantBrandingForHost(host, null);
    return resolveAppLocale({
      cookieLocale: null,
      tenantDefaultLocale: branding.defaultLocale,
    });
  }

  return resolveAppLocale({ cookieLocale: null, tenantDefaultLocale: null });
}
