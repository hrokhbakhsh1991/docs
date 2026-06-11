import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import { CatalogCoverImage } from "@/catalog/catalog-cover-image";
import {
  formatCatalogCardDates,
  formatCatalogCardDescription,
  formatCatalogCardSubtitle,
  formatCatalogPrice,
  shouldShowCatalogPrice,
} from "@/catalog/format-catalog-display";
import { resolveIntlDateLocale, isAppLocale, type AppLocale } from "@/i18n/routing";
import { resolveWebRegistrationUrl } from "@/portal/resolve-web-registration-url";
import {
  buildMarketingNotFoundMetadata,
  buildMarketingTourDetailMetadata,
} from "@/seo/build-marketing-metadata";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { resolveMarketingBootstrapForHost } from "@/tenant/resolve-marketing-bootstrap";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly params: Promise<{ readonly tourId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tourId } = await params;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const bootstrap = await resolveMarketingBootstrapForHost(host);
  const t = await getTranslations("catalog");
  const [branding, tour] = await Promise.all([
    fetchPublicTenantBrandingForHost(host),
    fetchCatalogTour({ ...bootstrap, tourId }),
  ]);
  const siteName = branding.displayName ?? t("nav.defaultSiteName");

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
    pluginId: bootstrap.pluginId,
    defaultTourTitle: t("detail.defaultTourTitle"),
  });
}

export default async function MarketingTourDetailPage({ params }: PageProps) {
  const { tourId } = await params;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const bootstrap = await resolveMarketingBootstrapForHost(host);
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const tour = await fetchCatalogTour({ ...bootstrap, tourId });

  if (tour === null) {
    notFound();
  }

  const description = formatCatalogCardDescription(tour);
  const subtitle = formatCatalogCardSubtitle(tour, bootstrap.pluginId);
  const registrationUrl = resolveWebRegistrationUrl(host, tourId, bootstrap.pluginId);

  return (
    <main data-marketing-catalog-tour-detail>
      <h1>{tour.title || t("detail.defaultTourTitle")}</h1>
      {tour.coverImageUrl ? <CatalogCoverImage src={tour.coverImageUrl} /> : null}
      {description ? <p>{description}</p> : null}
      <p>
        {[subtitle, formatCatalogCardDates(tour, dateLocale, t("detail.datesTba"))]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {shouldShowCatalogPrice(bootstrap.pluginId, tour.priceAmount) ? (
        <p>{formatCatalogPrice(tour.priceAmount, tour.priceCurrency, dateLocale, t("detail.priceOnRequest"))}</p>
      ) : null}
      {tour.spotsRemaining != null ? (
        <p>{t("detail.spotsRemaining", { count: tour.spotsRemaining })}</p>
      ) : tour.totalCapacity != null ? (
        <p>{t("detail.capacity", { count: tour.totalCapacity })}</p>
      ) : null}
      {tour.difficultyLevel != null ? (
        <p>{t("detail.difficulty", { level: tour.difficultyLevel })}</p>
      ) : null}
      {tour.fitnessLevel ? <p>{t("detail.fitness", { level: tour.fitnessLevel })}</p> : null}
      {registrationUrl ? (
        <p>
          <a href={registrationUrl} data-marketing-register>
            {t("detail.register")}
          </a>
        </p>
      ) : null}
      <p>
        <Link href="/tours">{t("detail.backToTours")}</Link>
      </p>
    </main>
  );
}
