import "@app-tour/workspace-plugin-host/register";

import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { isAppLocale, resolveTextDirection, routing } from "@/i18n/routing";
import { inter, resolveAppFontClassName, resolveAppFontFamilyCss, vazirmatn, calistoga } from "@/i18n/app-fonts";
import { PortalProviders } from "@/shell/portal-providers";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import "@/bootstrap/workspace-guest-theme-stylesheets.generated";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Registration",
  description: "Tour registration",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [headerList, localeRaw, messages] = await Promise.all([
    headers(),
    getLocale(),
    getMessages(),
  ]);
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const host = headerList.get("host") ?? "localhost:3003";
  const [branding, bootstrap] = await Promise.all([
    fetchPublicTenantBrandingForHost(host),
    resolvePortalBootstrapForHost(host),
  ]);
  const theme = {
    displayName: branding.displayName ?? undefined,
    primaryColor: branding.primaryColor ?? undefined,
  };
  const dir = resolveTextDirection(locale);
  const fontClassName = resolveAppFontClassName(locale);
  const fontFamilyBase = resolveAppFontFamilyCss(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${vazirmatn.variable} ${inter.variable} ${calistoga.variable} ${fontClassName}`}
      style={{ ["--font-family-base" as string]: fontFamilyBase }}
    >
      <body
        data-app="portal"
        data-app-surface="portal"
        data-workspace-plugin={bootstrap.pluginId}
        data-tenant-id={bootstrap.tenantId}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PortalProviders theme={theme}>{children}</PortalProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
