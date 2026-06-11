import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { buildRootLayoutMetadata } from "@/i18n/app-page-metadata";
import { inter, resolveAppFontClassName, resolveAppFontFamilyCss, vazirmatn } from "@/i18n/app-fonts";
import { isAppLocale, resolveTextDirection, routing } from "@/i18n/routing";
import { AppProviders } from "@/providers/app-providers";
import { fetchTenantThemeForContext } from "@/tenant/fetch-tenant-theme.server";
import {
  isPublicCatalogPath,
  resolvePublicCatalogRootSessionForHost,
} from "@/tenant/resolve-public-catalog-bootstrap.server";
import { resolveBootstrapAppSessionForHost, toSerializableBootstrap } from "@/tenant/tenant-kernel";

import "@app-tour/workspace-denali/theme/denali-admin.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return buildRootLayoutMetadata();
}

/** Session is resolved per request — do not prerender with module-static dev identity. */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [headerList, localeRaw, messages] = await Promise.all([headers(), getLocale(), getMessages()]);
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const host = headerList.get("host") ?? "localhost:3000";
  const pathname = headerList.get("x-pathname") ?? "";
  const resolved = isPublicCatalogPath(pathname)
    ? await resolvePublicCatalogRootSessionForHost(host)
    : resolveBootstrapAppSessionForHost(host);
  const tenantTheme = await fetchTenantThemeForContext(resolved.context, host);
  const bootstrap = toSerializableBootstrap(resolved, tenantTheme ?? undefined);
  const dir = resolveTextDirection(locale);

  const fontClassName = resolveAppFontClassName(locale);
  const fontFamilyBase = resolveAppFontFamilyCss(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${vazirmatn.variable} ${inter.variable} ${fontClassName}`}
      style={{ ["--font-family-base" as string]: fontFamilyBase }}
    >
      <body
        data-tenant-id={resolved.context.tenantId}
        data-workspace-plugin={bootstrap.pluginId}
        data-locale={locale}
        data-dir={dir}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders bootstrap={bootstrap}>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
