import Link from "next/link";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveCatalogDetailSections } from "@app-tour/workspace-sdk";

import { CatalogTourDetailPhotoLightboxShell } from "./catalog-tour-detail-photo-lightbox-shell";
import { CatalogTourDetailPhotoLightboxTrigger } from "./catalog-tour-detail-photo-lightbox";
import { CatalogTourBreadcrumb } from "./catalog-tour-breadcrumb";
import { CatalogCoverImage } from "./catalog-cover-image";
import { CatalogTourDetailBookingRail } from "./catalog-tour-detail-booking-rail";
import { CatalogTourDetailFacts } from "./catalog-tour-detail-facts";
import { CatalogTourDetailJumpNav } from "./catalog-tour-detail-jump-nav";
import { CatalogTourDetailStickyBar } from "./catalog-tour-detail-sticky-bar";
import { CatalogTourDetailGallery } from "./catalog-tour-detail-gallery";
import { CatalogTourDetailHeroGallery } from "./catalog-tour-detail-hero-gallery";
import { CatalogTourDetailGearServices } from "./catalog-tour-detail-gear-services";
import { CatalogTourDetailLogistics } from "./catalog-tour-detail-logistics";
import { CatalogTourDetailReadiness } from "./catalog-tour-detail-readiness";
import { CatalogItinerarySection } from "./catalog-itinerary-section";
import { CatalogTourDetailFaq } from "./catalog-tour-detail-faq";
import { CatalogTourDetailPolicies } from "./catalog-tour-detail-policies";
import { CatalogTourDetailRegisterPreview } from "./catalog-tour-detail-register-preview";
import { buildCatalogTourMetaLine } from "./build-catalog-tour-meta-line";
import {
  hasMarketingCatalogSurface,
  resolveMarketingCatalogSurface,
} from "./resolve-marketing-catalog-surface";

import { tourHasRegisterPreviewData } from "./build-catalog-register-preview-items";
import { tourHasOverflowGalleryPhotos } from "./build-catalog-tour-photo-set";
import { resolveMarketingCatalogCardCategoryLabel } from "./resolve-marketing-catalog-category-label";
import type { MarketingCatalogCard } from "./catalog-types";
import { formatCatalogCardDescription } from "./format-catalog-display";
import { resolveCatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";
import { isAppLocale, resolveIntlDateLocale, resolveMarketingToursListPath, type AppLocale } from "@/i18n/routing";
import { resolveHomeTourCoverUrl } from "@/home/resolve-home-tour-cover-url";
import { buildValidatedMarketingTourStructuredData } from "@/seo/build-validated-marketing-structured-data";
import { buildTourDetailBreadcrumbJsonLd } from "@/seo/build-breadcrumb-jsonld";
import { buildMarketingTourDetailJsonLdGraph } from "@/seo/build-marketing-tour-detail-jsonld-graph";
import { serializeMarketingJsonLd } from "@/seo/serialize-marketing-jsonld";

export type CatalogTourDetailProps = {
  readonly tour: MarketingCatalogCard;
  readonly registrationUrl: string | null;
  readonly tourSignInUrl?: string | null;
  readonly pluginId: string;
};

function tourHasPolicies(tour: MarketingCatalogCard): boolean {
  const policiesText = tour.policiesText?.trim() ?? "";
  const hasCancellation =
    (tour.cancellationDeadlineHours != null && Number.isFinite(tour.cancellationDeadlineHours)) ||
    (tour.cancellationPenaltyPercentage != null &&
      Number.isFinite(tour.cancellationPenaltyPercentage));
  return policiesText.length > 0 || hasCancellation;
}

export async function CatalogTourDetail({
  tour,
  registrationUrl,
  tourSignInUrl = null,
  pluginId,
}: CatalogTourDetailProps) {
  const sections = resolveCatalogDetailSections(pluginId);
  const catalogSurface = await resolveMarketingCatalogSurface(pluginId);
  const detailPdpGates =
    catalogSurface?.resolveDetailPdpGates({
      tour,
      hasOverflowGallery: tourHasOverflowGalleryPhotos(tour),
      hasRegisterPreview: tourHasRegisterPreviewData(tour),
    }) ?? {
      showHeroGallery: false,
      showReadiness: false,
      showLogistics: false,
      showGear: false,
      showGalleryNav: false,
      showRegisterPreview: false,
      showFaq: false,
    };
  const hasExtendedCatalogLayout = hasMarketingCatalogSurface(pluginId);
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const toursHref = resolveMarketingToursListPath(locale);
  const dateLocale = resolveIntlDateLocale(locale);
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const title = tour.title?.trim() || t("detail.defaultTourTitle");
  const description = formatCatalogCardDescription(tour);
  const categoryLabel = await resolveMarketingCatalogCardCategoryLabel(tour.category, t);
  const metaLine = buildCatalogTourMetaLine(tour, dateLocale, t("detail.datesTba"), {
    categoryLabel,
  });
  const registration = resolveCatalogTourRegistrationState(tour, registrationUrl);
  const showItinerary =
    sections.itinerary && tour.itineraryDays != null && tour.itineraryDays.length > 0;
  const showPolicies = sections.policies && tourHasPolicies(tour);
  const showRegisterBlock = registration.canRegister || registration.isSoldOut;
  const longDescription = tour.longDescription?.trim() ?? "";
  const destinationLabel = tour.destinationLabel?.trim() ?? "";
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
    <CatalogTourDetailPhotoLightboxShell tour={tour} title={title}>
      <article
        data-marketing-catalog-tour-detail
        {...(registration.canRegister ? { "data-marketing-catalog-detail-has-sticky": true } : {})}
        {...(showRegisterBlock ? { "data-marketing-catalog-detail-has-booking-rail": true } : {})}
      >
        <div data-marketing-catalog-detail-layout>
          <div data-marketing-catalog-detail-main>
            <div data-marketing-catalog-detail-intro>
              <CatalogTourBreadcrumb
                locale={locale}
                homeLabel={t("home.title")}
                toursLabel={t("nav.tours")}
                tourTitle={title}
              />
              <Link href={toursHref} data-marketing-catalog-detail-back>
                {t("detail.backToTours")}
              </Link>

              {detailPdpGates.showHeroGallery ? (
                <CatalogTourDetailHeroGallery tour={tour} title={title} />
              ) : (
                <figure data-marketing-catalog-detail-cover data-marketing-catalog-detail-hero>
                  <CatalogTourDetailPhotoLightboxTrigger
                    index={0}
                    ariaLabel={t("detail.gallery.openPhoto", { index: 1 })}
                  >
                    <CatalogCoverImage
                      src={resolveHomeTourCoverUrl(tour.coverImageUrl)}
                      alt={title}
                      width={960}
                      height={540}
                    />
                  </CatalogTourDetailPhotoLightboxTrigger>
                </figure>
              )}

              <header data-marketing-catalog-detail-header>
                <h1 data-marketing-catalog-detail-title>{title}</h1>
                {destinationLabel.length > 0 ? (
                  <p data-marketing-catalog-detail-destination>{destinationLabel}</p>
                ) : null}
              </header>
            </div>

            {metaLine ? <p data-marketing-catalog-detail-meta>{metaLine}</p> : null}

            <CatalogTourDetailFacts
              tour={tour}
              pluginId={pluginId}
              registrationUrl={registrationUrl}
            />

            <CatalogTourDetailJumpNav
              showReadiness={detailPdpGates.showReadiness}
              showItinerary={showItinerary}
              showLogistics={detailPdpGates.showLogistics}
              showGear={detailPdpGates.showGear}
              showGallery={detailPdpGates.showGalleryNav}
              showPolicies={showPolicies}
              showRegisterPreview={detailPdpGates.showRegisterPreview}
              showFaq={detailPdpGates.showFaq}
            />

            {description ? <p data-marketing-catalog-detail-description>{description}</p> : null}
            {longDescription.length > 0 ? (
              <div data-marketing-catalog-detail-long-description>{longDescription}</div>
            ) : null}

            {hasExtendedCatalogLayout ? <CatalogTourDetailReadiness tour={tour} pluginId={pluginId} /> : null}
            {hasExtendedCatalogLayout ? <CatalogTourDetailGallery tour={tour} title={title} /> : null}

            <div data-marketing-catalog-detail-body>
              {showItinerary ? (
                <CatalogItinerarySection
                  days={tour.itineraryDays!}
                  heading={t("detail.itineraryHeading")}
                  dayLabel={(dayNumber) => t("detail.itineraryDay", { day: dayNumber })}
                  segmentsHeading={t("detail.itinerarySegments")}
                  segmentPhotosEmpty={t("detail.itinerarySegmentPhotosEmpty")}
                  locale={locale}
                  sectionId="catalog-detail-itinerary"
                  useAccordion={tour.itineraryDays!.length > 2}
                />
              ) : null}

              {hasExtendedCatalogLayout ? <CatalogTourDetailLogistics tour={tour} /> : null}
              {hasExtendedCatalogLayout ? <CatalogTourDetailGearServices tour={tour} /> : null}

              {showPolicies ? (
                <div id="catalog-detail-policies">
                  <CatalogTourDetailPolicies tour={tour} />
                </div>
              ) : null}

              {detailPdpGates.showRegisterPreview ? (
                <CatalogTourDetailRegisterPreview tour={tour} />
              ) : null}
              {detailPdpGates.showFaq ? <CatalogTourDetailFaq tour={tour} /> : null}
            </div>
          </div>

          <CatalogTourDetailBookingRail
            tour={tour}
            registration={registration}
            tourSignInUrl={tourSignInUrl}
          />
        </div>

        <CatalogTourDetailStickyBar
          tour={tour}
          registration={registration}
          tourSignInUrl={tourSignInUrl}
        />

        {detailJsonLdGraph != null ? (
          <script
            type="application/ld+json"
            data-marketing-catalog-jsonld-graph
            dangerouslySetInnerHTML={{ __html: serializeMarketingJsonLd(detailJsonLdGraph) }}
          />
        ) : null}
      </article>
    </CatalogTourDetailPhotoLightboxShell>
  );
}
