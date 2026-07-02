import Link from "next/link";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveCatalogDetailSections } from "@app-tour/workspace-sdk";

import { CatalogCoverImage } from "./catalog-cover-image";
import { CatalogTourBreadcrumb } from "./catalog-tour-breadcrumb";
import { CatalogItinerarySection } from "./catalog-itinerary-section";
import { CatalogTourDetailPolicies } from "./catalog-tour-detail-policies";
import { CatalogTourStats } from "./catalog-tour-stats";
import { buildCatalogTourMetaLine } from "./build-catalog-tour-meta-line";
import type { MarketingCatalogCard } from "./catalog-types";
import { formatCatalogCardDescription } from "./format-catalog-display";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";
import { buildValidatedMarketingTourStructuredData } from "@/seo/build-validated-marketing-structured-data";
import { buildTourDetailBreadcrumbJsonLd } from "@/seo/build-breadcrumb-jsonld";
import { buildMarketingTourDetailJsonLdGraph } from "@/seo/build-marketing-tour-detail-jsonld-graph";
import { serializeMarketingJsonLd } from "@/seo/serialize-marketing-jsonld";

export type CatalogTourDetailProps = {
  readonly tour: MarketingCatalogCard;
  readonly registrationUrl: string | null;
  readonly pluginId: string;
};

export async function CatalogTourDetail({
  tour,
  registrationUrl,
  pluginId,
}: CatalogTourDetailProps) {
  const sections = resolveCatalogDetailSections(pluginId);
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const title = tour.title?.trim() || t("detail.defaultTourTitle");
  const description = formatCatalogCardDescription(tour);
  const metaLine = buildCatalogTourMetaLine(tour, dateLocale, t("detail.datesTba"));
  const structuredData =
    tour.structuredData != null
      ? buildValidatedMarketingTourStructuredData({
          host,
          tourId: tour.id,
          structuredData: tour.structuredData,
        })
      : null;
  const breadcrumbJsonLd = buildTourDetailBreadcrumbJsonLd({
    host,
    tourId: tour.id,
    tourTitle: title,
    toursLabel: t("nav.tours"),
    homeLabel: t("home.title"),
  });
  const detailJsonLdGraph = buildMarketingTourDetailJsonLdGraph({
    structuredData,
    breadcrumbJsonLd,
  });

  return (
    <article data-marketing-catalog-tour-detail>
      <CatalogTourBreadcrumb
        locale={locale}
        homeLabel={t("home.title")}
        toursLabel={t("nav.tours")}
        tourTitle={title}
      />
      <header data-marketing-catalog-detail-header>
        <Link href="/tours" data-marketing-catalog-detail-back>
          {t("detail.backToTours")}
        </Link>
        <h1 data-marketing-catalog-detail-title>{title}</h1>
      </header>

      {tour.coverImageUrl ? (
        <figure data-marketing-catalog-detail-cover>
          <CatalogCoverImage src={tour.coverImageUrl} alt={title} width={960} height={540} />
        </figure>
      ) : null}

      <div data-marketing-catalog-detail-body>
        {description ? <p data-marketing-catalog-detail-description>{description}</p> : null}
        {metaLine ? <p data-marketing-catalog-detail-meta>{metaLine}</p> : null}

        <CatalogTourStats tour={tour} testId="detail" pluginId={pluginId} />

        {sections.itinerary && tour.itineraryDays != null && tour.itineraryDays.length > 0 ? (
          <CatalogItinerarySection
            days={tour.itineraryDays}
            heading={t("detail.itineraryHeading")}
            dayLabel={(dayNumber) => t("detail.itineraryDay", { day: dayNumber })}
            segmentsHeading={t("detail.itinerarySegments")}
          />
        ) : null}

        {sections.policies ? <CatalogTourDetailPolicies tour={tour} /> : null}

        {registrationUrl ? (
          <footer data-marketing-catalog-detail-actions>
            <a href={registrationUrl} data-marketing-register>
              {t("detail.register")}
            </a>
          </footer>
        ) : null}
      </div>

      {detailJsonLdGraph != null ? (
        <script
          type="application/ld+json"
          data-marketing-catalog-jsonld-graph
          dangerouslySetInnerHTML={{ __html: serializeMarketingJsonLd(detailJsonLdGraph) }}
        />
      ) : null}
    </article>
  );
}
