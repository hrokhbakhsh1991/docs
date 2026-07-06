import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveHomeTourCoverUrl } from "@/home/resolve-home-tour-cover-url";

import { resolveMarketingCatalogCardCategoryLabel } from "./resolve-marketing-catalog-category-label";
import { buildCatalogListCardSummary } from "./build-catalog-list-card-summary";
import { hasMarketingCatalogSurface } from "./resolve-marketing-catalog-surface";

import { CatalogCoverImage } from "./catalog-cover-image";
import type { MarketingCatalogCard } from "./catalog-types";
import {
  formatCatalogCardDates,
  formatCatalogCardDescription,
  formatCatalogPrice,
  shouldShowCatalogPrice,
} from "./format-catalog-display";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";

export type CatalogTourCardProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
};

export async function CatalogTourCard({ tour, pluginId }: CatalogTourCardProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const detailHref = `/tours/${tour.id}`;
  const title = tour.title?.trim() || t("detail.untitled");
  const hasExtendedCatalogLayout = hasMarketingCatalogSurface(pluginId);
  const summaryLine = buildCatalogListCardSummary(tour, t, { pluginId });
  const description =
    !hasExtendedCatalogLayout && summaryLine == null ? formatCatalogCardDescription(tour) : null;
  const datesLine = formatCatalogCardDates(tour, dateLocale, t("detail.datesTba"));
  const categorySlug = tour.category?.trim();
  const categoryLabel = resolveMarketingCatalogCardCategoryLabel(categorySlug, t);
  const showPrice = shouldShowCatalogPrice(tour);
  const priceLine = showPrice
    ? formatCatalogPrice(tour.priceAmount, tour.priceCurrency, dateLocale, t("detail.priceOnRequest"))
    : null;
  const coverSrc = resolveHomeTourCoverUrl(tour.coverImageUrl);
  const soldOut = tour.spotsRemaining === 0;

  return (
    <article data-marketing-catalog-card {...(soldOut ? { "data-marketing-catalog-card-sold-out": true } : {})}>
      <figure data-marketing-catalog-card-media>
        <Link href={detailHref} data-marketing-catalog-card-cover>
          <CatalogCoverImage src={coverSrc} alt={title} width={640} height={360} cover />
        </Link>
        {priceLine ? <span data-marketing-catalog-card-price>{priceLine}</span> : null}
        {soldOut ? (
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
        {categoryLabel ? (
          <p data-marketing-catalog-card-category>{categoryLabel}</p>
        ) : null}
        {datesLine ? <p data-marketing-catalog-card-dates>{datesLine}</p> : null}
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
