import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import {
  resolveTextDirection,
  isAppLocale,
  resolveMarketingLocalePath,
  routing,
} from "@/i18n/routing";
import {
  inter,
  resolveAppFontClassName,
  resolveAppFontFamilyCss,
  vazirmatn,
  calistoga,
} from "@/i18n/app-fonts";
import { MaintenancePage } from "@/platform/maintenance-page";
import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";
import { PlatformMotherShell } from "@/platform/platform-mother-shell";
import { buildMarketingLayoutJsonLd } from "@/seo/build-layout-jsonld";
import {
  buildMarketingSiteMetadata,
  buildMarketingSurfaceNoindexMetadata,
} from "@/seo/build-marketing-metadata";
import { serializeMarketingJsonLd } from "@/seo/serialize-marketing-jsonld";
import {
  resolvePortalMemberLoginUrl,
  resolvePortalMemberModuleUrl,
  resolvePortalPublicBaseUrl,
  resolveMemberLoginCatalogTourId,
  resolveGuestChromeDisplayName,
} from "@app-tour/guest-surface-host";
import { resolveGuestLandingFeatures } from "@app-tour/workspace-sdk";
import { resolveMarketingMemberHeader } from "@/shell/resolve-marketing-member-header.server";
import { MarketingProviders } from "@/shell/marketing-providers";
import { MarketingShell } from "@/shell/marketing-shell";
import { MarketingLoginModalProvider } from "@/auth/marketing-login-modal";
import { resolveMarketingShellNavLinks } from "@/shell/resolve-marketing-shell-nav.server";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { isMarketingSurfaceEnabled } from "@/tenant/marketing-site-surfaces";
import { resolveMarketingBootstrapForHost } from "@/tenant/resolve-marketing-bootstrap";
import { resolveMarketingSiteSurfacesForHost } from "@/tenant/resolve-marketing-site-surfaces";
import { importGuestMarketingThemeForPlugin } from "@app-tour/guest-workspace-runtime/themes/marketing";

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
  const siteName = resolveGuestChromeDisplayName(branding.displayName, t("nav.defaultSiteName"));
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
        <body data-app-surface="marketing" data-workspace-plugin="platform">
          <PlatformMotherShell>{children}</PlatformMotherShell>
        </body>
      </html>
    );
  }

  const siteSurfaces = await resolveMarketingSiteSurfacesForHost(host);
  if (!isMarketingSurfaceEnabled(siteSurfaces)) {
    return (
      <html lang={locale} dir={dir}>
        <body
          data-app-surface="marketing"
          data-workspace-plugin="platform"
          data-marketing-surface-maintenance
        >
          <MaintenancePage title="فروشگاه" />
        </body>
      </html>
    );
  }

  const branding = await fetchPublicTenantBrandingForHost(host);
  const bootstrap = await resolveMarketingBootstrapForHost(host);
  await importGuestMarketingThemeForPlugin(bootstrap.pluginId);
  const siteName = resolveGuestChromeDisplayName(
    branding.displayName,
    (await getTranslations("catalog"))("nav.defaultSiteName")
  );
  const layoutJsonLd = buildMarketingLayoutJsonLd({ host, siteName });
  const fontClassName = resolveAppFontClassName(locale);
  const fontFamilyBase = resolveAppFontFamilyCss(locale);
  const portalMemberModuleUrl = resolvePortalMemberModuleUrl(host, undefined, bootstrap.pluginId);
  const portalMemberLoginUrl = resolvePortalMemberLoginUrl(host, undefined, bootstrap.pluginId);
  const portalPublicBaseUrl = resolvePortalPublicBaseUrl(host);
  const memberLoginTourId = resolveMemberLoginCatalogTourId(bootstrap.pluginId);
  const marketingHomeHref = resolveMarketingLocalePath("/", locale);
  const memberHeader = await resolveMarketingMemberHeader(
    host,
    bootstrap.tenantId,
    bootstrap.pluginId
  );
  const primaryNavLinks = resolveMarketingShellNavLinks(host, bootstrap.pluginId, locale);
  const landing = resolveGuestLandingFeatures(bootstrap.pluginId);

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
          <MarketingLoginModalProvider
            portalPublicBaseUrl={portalPublicBaseUrl}
            pluginId={bootstrap.pluginId}
            tenantId={bootstrap.tenantId}
            defaultTourId={memberLoginTourId}
            defaultTourTitle={siteName}
            backHref={marketingHomeHref}
            memberModuleHref={portalMemberModuleUrl}
          >
            <MarketingProviders>
              <MarketingShell
                branding={branding}
                portalMemberLoginUrl={portalMemberLoginUrl}
                portalMemberModuleUrl={portalMemberModuleUrl}
                memberHeader={memberHeader}
                primaryNavLinks={primaryNavLinks}
                landing={landing}
              >
                {children}
              </MarketingShell>
            </MarketingProviders>
          </MarketingLoginModalProvider>
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
