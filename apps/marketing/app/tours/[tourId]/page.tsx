import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { CatalogTourDetail } from "@/catalog/catalog-tour-detail";
import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import { isAppLocale, routing } from "@/i18n/routing";
import { resolveWebRegistrationLoginUrl, resolveWebRegistrationUrl } from "@/portal/resolve-web-registration-url";
import {
  buildMarketingNotFoundMetadata,
  buildMarketingTourDetailMetadata,
} from "@/seo/build-marketing-metadata";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";
import { resolveMarketingBootstrapForHost } from "@/tenant/resolve-marketing-bootstrap";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly params: Promise<{ readonly tourId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tourId } = await params;
  const [headerList, localeRaw] = await Promise.all([headers(), getLocale()]);
  const host = headerList.get("host") ?? "localhost:3002";
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const bootstrap = await resolveMarketingBootstrapForHost(host);
  const t = await getTranslations("catalog");
  const [branding, tour] = await Promise.all([
    fetchPublicTenantBrandingForHost(host),
    fetchCatalogTour({ ...bootstrap, tourId }),
  ]);
  const siteName = resolveGuestChromeDisplayName(branding.displayName, t("nav.defaultSiteName"));

  if (tour === null) {
    return buildMarketingNotFoundMetadata({
      title: t("metadata.notFoundTitle"),
      description: t("metadata.notFoundDescription"),
    });
  }

  return buildMarketingTourDetailMetadata({
    host,
    siteName,
    tour,
    tourId,
    defaultTourTitle: t("detail.defaultTourTitle"),
    pluginId: bootstrap.pluginId,
    locale,
  });
}

export default async function MarketingTourDetailPage({ params }: PageProps) {
  const { tourId } = await params;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const bootstrap = await resolveMarketingBootstrapForHost(host);
  const tour = await fetchCatalogTour({ ...bootstrap, tourId });

  if (tour === null) {
    notFound();
  }

  const registrationUrl = resolveWebRegistrationUrl(host, tourId, bootstrap.pluginId);
  const tourSignInUrl = resolveWebRegistrationLoginUrl(host, tourId, bootstrap.pluginId);

  return (
    <div data-marketing-catalog-detail-page data-slot="page-catalog-detail">
      <CatalogTourDetail
        tour={tour}
        registrationUrl={registrationUrl}
        tourSignInUrl={tourSignInUrl}
        pluginId={bootstrap.pluginId}
      />
    </div>
  );
}
