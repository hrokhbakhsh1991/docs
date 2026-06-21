import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { resolveTextDirection, isAppLocale, routing } from "@/i18n/routing";
import { MaintenancePage } from "@/platform/maintenance-page";
import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";
import { PlatformMotherShell } from "@/platform/platform-mother-shell";
import { buildMarketingSiteMetadata } from "@/seo/build-marketing-metadata";
import { MarketingProviders } from "@/shell/marketing-providers";
import { MarketingShell } from "@/shell/marketing-shell";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { isMarketingSurfaceEnabled } from "@/tenant/marketing-site-surfaces";
import { resolveMarketingSiteSurfacesForHost } from "@/tenant/resolve-marketing-site-surfaces";

import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const branding = await fetchPublicTenantBrandingForHost(host);
  const t = await getTranslations("catalog");
  const siteName = branding.displayName ?? t("nav.defaultSiteName");
  return {
    ...buildMarketingSiteMetadata({ host, siteName, toursLabel: t("nav.tours") }),
    description: t("metadata.siteDescription", { siteName }),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [headerList, localeRaw, messages] = await Promise.all([
    headers(),
    getLocale(),
    getMessages(),
  ]);
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const host = headerList.get("host") ?? "localhost:3002";
  const dir = resolveTextDirection(locale);

  if (isPlatformMotherHost(host)) {
    return (
      <html lang={locale} dir={dir}>
        <body>
          <PlatformMotherShell>{children}</PlatformMotherShell>
        </body>
      </html>
    );
  }

  const siteSurfaces = await resolveMarketingSiteSurfacesForHost(host);
  if (!isMarketingSurfaceEnabled(siteSurfaces)) {
    return (
      <html lang={locale} dir={dir}>
        <body data-marketing-surface-maintenance>
          <MaintenancePage title="فروشگاه" />
        </body>
      </html>
    );
  }

  const branding = await fetchPublicTenantBrandingForHost(host);
  const theme = {
    displayName: branding.displayName ?? undefined,
    primaryColor: branding.primaryColor ?? undefined,
  };

  return (
    <html lang={locale} dir={dir}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <MarketingProviders theme={theme}>
            <MarketingShell branding={branding}>{children}</MarketingShell>
          </MarketingProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
