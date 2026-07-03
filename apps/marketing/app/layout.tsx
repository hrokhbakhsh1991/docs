import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { resolveTextDirection, isAppLocale, routing } from "@/i18n/routing";
import { inter, resolveAppFontClassName, resolveAppFontFamilyCss, vazirmatn, calistoga } from "@/i18n/app-fonts";
import { MaintenancePage } from "@/platform/maintenance-page";
import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";
import { PlatformMotherShell } from "@/platform/platform-mother-shell";
import { buildMarketingLayoutJsonLd } from "@/seo/build-layout-jsonld";
import {
  buildMarketingSiteMetadata,
  buildMarketingSurfaceNoindexMetadata,
} from "@/seo/build-marketing-metadata";
import { serializeMarketingJsonLd } from "@/seo/serialize-marketing-jsonld";
import { resolvePortalMemberAreaUrl } from "@app-tour/guest-surface-host";
import { MarketingProviders } from "@/shell/marketing-providers";
import { MarketingShell } from "@/shell/marketing-shell";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { isMarketingSurfaceEnabled } from "@/tenant/marketing-site-surfaces";
import { resolveMarketingBootstrapForHost } from "@/tenant/resolve-marketing-bootstrap";
import { resolveMarketingSiteSurfacesForHost } from "@/tenant/resolve-marketing-site-surfaces";

import "@/bootstrap/workspace-guest-theme-stylesheets.generated";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [headerList, localeRaw] = await Promise.all([headers(), getLocale()]);
  const host = headerList.get("host") ?? "localhost:3002";
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const t = await getTranslations("catalog");

  if (isPlatformMotherHost(host)) {
    return buildMarketingSurfaceNoindexMetadata({
      title: t("metadata.motherTitle"),
      description: t("metadata.motherDescription"),
    });
  }

  const siteSurfaces = await resolveMarketingSiteSurfacesForHost(host);
  if (!isMarketingSurfaceEnabled(siteSurfaces)) {
    return buildMarketingSurfaceNoindexMetadata({
      title: t("metadata.maintenanceTitle"),
      description: t("metadata.maintenanceDescription"),
    });
  }

  const branding = await fetchPublicTenantBrandingForHost(host);
  const siteName = branding.displayName ?? t("nav.defaultSiteName");
  return {
    ...buildMarketingSiteMetadata({ host, siteName, toursLabel: t("nav.tours"), locale }),
    description: t("metadata.siteDescription", { siteName }),
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    },
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
  const bootstrap = await resolveMarketingBootstrapForHost(host);
  const theme = {
    displayName: branding.displayName ?? undefined,
    primaryColor: branding.primaryColor ?? undefined,
  };
  const siteName = branding.displayName ?? (await getTranslations("catalog"))("nav.defaultSiteName");
  const layoutJsonLd = buildMarketingLayoutJsonLd({ host, siteName });
  const fontClassName = resolveAppFontClassName(locale);
  const fontFamilyBase = resolveAppFontFamilyCss(locale);
  const portalMemberAreaUrl = resolvePortalMemberAreaUrl(host);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${vazirmatn.variable} ${inter.variable} ${calistoga.variable} ${fontClassName}`}
      style={{ ["--font-family-base" as string]: fontFamilyBase }}
    >
      <body
        data-app-surface="marketing"
        data-workspace-plugin={bootstrap.pluginId}
        data-tenant-id={bootstrap.tenantId}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <MarketingProviders theme={theme}>
            <MarketingShell branding={branding} portalMemberAreaUrl={portalMemberAreaUrl}>
              {children}
            </MarketingShell>
          </MarketingProviders>
        </NextIntlClientProvider>
        <script
          type="application/ld+json"
          data-marketing-layout-jsonld
          dangerouslySetInnerHTML={{ __html: serializeMarketingJsonLd(layoutJsonLd) }}
        />
      </body>
    </html>
  );
}
