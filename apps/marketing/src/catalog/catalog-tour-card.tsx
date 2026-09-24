import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveHomeTourCoverUrl } from "@/home/resolve-home-tour-cover-url";
import { MARKETING_FALLBACK_TOUR_CARD_COVER_PATH } from "@/home/home-marketing-assets";

import { resolveMarketingCatalogCardCategoryLabel } from "./resolve-marketing-catalog-category-label";
import { formatCatalogTransportMode } from "./format-catalog-transport";
import { buildCatalogListCardSummary } from "./build-catalog-list-card-summary";
import { resolveCatalogPriceDisplay } from "./resolve-catalog-price-display";
import { hasMarketingCatalogSurface } from "./resolve-marketing-catalog-surface";

import { CatalogCoverImage } from "./catalog-cover-image";
import type { MarketingCatalogCard } from "./catalog-types";
import { CatalogCommercialPricingCompact } from "./catalog-commercial-pricing";
import type { MarketingCommercialPricingPreview } from "./commercial-pricing-preview";
import {
  formatCatalogCardDates,
  formatCatalogCardDescription,
  formatCatalogPrice,
  shouldShowCatalogPrice,
} from "./format-catalog-display";
import {
  isAppLocale,
  resolveIntlDateLocale,
  resolveMarketingLocalePath,
  type AppLocale,
} from "@/i18n/routing";

export type CatalogTourCardProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
  readonly pricingPreview?: MarketingCommercialPricingPreview | null;
};

export async function CatalogTourCard({
  tour,
  pluginId,
  pricingPreview = null,
}: CatalogTourCardProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const detailHref = resolveMarketingLocalePath(`/tours/${tour.id}`, locale);
  const title = tour.title?.trim() || t("detail.untitled");
  const hasExtendedCatalogLayout = hasMarketingCatalogSurface(pluginId);
  const priceDisplayPolicy = resolveCatalogPriceDisplay(pluginId);
  const summaryLine = await buildCatalogListCardSummary(tour, t, { pluginId });
  const description =
    !hasExtendedCatalogLayout && summaryLine == null ? formatCatalogCardDescription(tour) : null;
  const datesLine = formatCatalogCardDates(tour, dateLocale, t("detail.datesTba"));
  const categorySlug = tour.category?.trim();
  const categoryLabel = await resolveMarketingCatalogCardCategoryLabel(categorySlug, t);
  const transportLabel = formatCatalogTransportMode(tour.transport, t);
  const showPrice = shouldShowCatalogPrice(tour);
  const priceLine = showPrice
    ? formatCatalogPrice(
        tour.priceAmount,
        tour.priceCurrency,
        dateLocale,
        t("detail.priceOnRequest"),
        priceDisplayPolicy
      )
    : null;
  const coverSrc = resolveHomeTourCoverUrl(tour.coverImageUrl);
  const soldOut = tour.spotsRemaining === 0;
  const registrationState =
    tour.registrationState ??
    (soldOut ? (tour.waitlistEnabled === true ? "waitlist" : "closed") : "open");
  const isPast = registrationState === "past";

  return (
    <article
      data-marketing-catalog-card
      {...(soldOut ? { "data-marketing-catalog-card-sold-out": true } : {})}
      {...(isPast ? { "data-marketing-catalog-card-past": true } : {})}
    >
      <figure data-marketing-catalog-card-media>
        <Link href={detailHref} data-marketing-catalog-card-cover>
          <CatalogCoverImage
            src={coverSrc}
            alt={title}
            width={640}
            height={360}
            sizes="(max-width: 48rem) calc(100vw - 3rem), (max-width: 64rem) 50vw, 33vw"
            fallbackSrc={MARKETING_FALLBACK_TOUR_CARD_COVER_PATH}
            cover
          />
        </Link>
        <CatalogCommercialPricingCompact
          preview={pricingPreview}
          canonicalPrice={priceLine}
          dateLocale={dateLocale}
          priceDisplayPolicy={priceDisplayPolicy}
          t={t}
        />
        {isPast ? (
          <span data-marketing-catalog-card-spots>{t("list.card.past")}</span>
        ) : registrationState === "waitlist" ? (
          <span data-marketing-catalog-card-spots>{t("list.card.waitlist")}</span>
        ) : soldOut ? (
          <span data-marketing-catalog-card-spots>{t("list.card.soldOut")}</span>
        ) : tour.spotsRemaining != null && tour.spotsRemaining <= 5 ? (
          <span data-marketing-catalog-card-spots>
            {t("detail.spotsRemaining", { count: tour.spotsRemaining })}
          </span>
        ) : null}
      </figure>
      <div data-marketing-catalog-card-body>
        <h2 data-marketing-catalog-card-title>
          <Link href={detailHref}>{title}</Link>
        </h2>
        {categoryLabel ? <p data-marketing-catalog-card-category>{categoryLabel}</p> : null}
        {datesLine ? <p data-marketing-catalog-card-dates>{datesLine}</p> : null}
        {transportLabel ? (
          <p data-marketing-catalog-card-transport>
            <span>{t("detail.logistics.transport")}:</span> {transportLabel}
          </p>
        ) : null}
        {summaryLine ? (
          <p data-marketing-catalog-card-summary>{summaryLine}</p>
        ) : description ? (
          <p data-marketing-catalog-card-description>{description}</p>
        ) : null}
        <Link href={detailHref} data-marketing-catalog-card-cta>
          {t("list.viewTour")}
        </Link>
      </div>
    </article>
  );
}
