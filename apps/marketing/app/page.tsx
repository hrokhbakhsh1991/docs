import type { Metadata } from "next";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { renderHomePage } from "@/home/render-home-page";
import { fetchHomeCatalogItems } from "@/home/fetch-home-catalog-items";
import { fetchCatalogList } from "@/catalog/fetch-catalog-list";
import { isAppLocale, resolveMarketingLocalePath, routing } from "@/i18n/routing";
import { buildPlatformAdminUrl } from "@/platform/build-platform-admin-url";
import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";
import {
  buildMarketingSiteMetadata,
  MARKETING_OG_IMAGE_HEIGHT,
  MARKETING_OG_IMAGE_WIDTH,
} from "@/seo/build-marketing-metadata";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { resolveMarketingBootstrapForHost } from "@/tenant/resolve-marketing-bootstrap";
import { resolveGuestLandingFeatures, resolveGuestSeoForPlugin } from "@app-tour/workspace-sdk";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [headerList, localeRaw] = await Promise.all([headers(), getLocale()]);
  const host = headerList.get("host") ?? "localhost:3002";
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;

  if (isPlatformMotherHost(host)) {
    return { title: "Platform" };
  }

  const bootstrap = await resolveMarketingBootstrapForHost(host);
  const guestSeo = resolveGuestSeoForPlugin(bootstrap.pluginId).marketing;
  const landing = resolveGuestLandingFeatures(bootstrap.pluginId);
  const branding = await fetchPublicTenantBrandingForHost(host);
  const t = await getTranslations("catalog");
  const siteName = branding.displayName ?? t("nav.defaultSiteName");

  const title = guestSeo.homeTitleKey
    ? t(guestSeo.homeTitleKey, { siteName })
    : siteName;
  const description = guestSeo.homeDescriptionKey
    ? t(guestSeo.homeDescriptionKey, { siteName })
    : t("metadata.siteDescription", { siteName });

  return {
    ...buildMarketingSiteMetadata({
      host,
      siteName,
      toursLabel: t("nav.tours"),
      locale,
    }),
    title,
    description,
    alternates: {
      canonical: resolveMarketingLocalePath("/", locale),
    },
    ...(landing.sections.hero
      ? {
          openGraph: {
            images: [
              {
                url: "/home/hero-og.webp",
                width: MARKETING_OG_IMAGE_WIDTH,
                height: MARKETING_OG_IMAGE_HEIGHT,
              },
            ],
          },
        }
      : {}),
  };
}

export default async function MarketingHomePage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";

  if (isPlatformMotherHost(host)) {
    return (
      <main data-platform-mother-home data-slot="shell-main">
        <h1>پلتفرم مدیریت باشگاه کوهنوردی</h1>
        <a href={buildPlatformAdminUrl()} data-platform-admin-cta>
          ورود PlatformOps
        </a>
      </main>
    );
  }

  const bootstrap = await resolveMarketingBootstrapForHost(host);
  const landing = resolveGuestLandingFeatures(bootstrap.pluginId);
  const branding = await fetchPublicTenantBrandingForHost(host);
  const catalogItems = await fetchHomeCatalogItems({
    landing,
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    fetchCatalogList,
  });

  return renderHomePage({
    landing,
    branding,
    catalogItems,
    pluginId: bootstrap.pluginId,
    host,
  });
}
