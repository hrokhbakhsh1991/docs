import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { CatalogCoverImage } from "@/catalog/catalog-cover-image";
import type { MarketingCatalogCard } from "@/catalog/catalog-types";
import {
  formatCatalogCardDates,
  formatCatalogPrice,
  shouldShowCatalogPrice,
} from "@/catalog/format-catalog-display";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";

import { resolveHomeTourCoverUrl } from "./resolve-home-tour-cover-url";

export type HomeFeaturedTourCardProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
  readonly featured?: boolean;
  readonly flagshipLabel?: string;
};

export async function HomeFeaturedTourCard({
  tour,
  pluginId: _pluginId,
  featured = false,
  flagshipLabel,
}: HomeFeaturedTourCardProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const detailHref = `/tours/${tour.id}`;
  const title = tour.title?.trim() || t("detail.untitled");
  const datesLine = formatCatalogCardDates(tour, dateLocale, t("detail.datesTba"));
  const showPrice = shouldShowCatalogPrice(tour);
  const priceLine = showPrice
    ? formatCatalogPrice(tour.priceAmount, tour.priceCurrency, dateLocale, t("detail.priceOnRequest"))
    : null;
  const coverSrc = resolveHomeTourCoverUrl(tour.coverImageUrl);
  const hasCatalogCover = Boolean(tour.coverImageUrl?.trim());

  return (
    <article
      data-marketing-home-featured-card
      {...(featured ? { "data-marketing-home-featured-card-primary": true } : {})}
    >
      <figure
        data-marketing-home-featured-cover
        {...(!hasCatalogCover ? { "data-marketing-home-featured-cover-fallback": true } : {})}
      >
        <Link href={detailHref}>
          <CatalogCoverImage
            src={coverSrc}
            alt={title}
            width={featured ? 960 : 640}
            height={featured ? 540 : 360}
            cover
            priority={featured}
          />
        </Link>
      </figure>
      <div data-marketing-home-featured-card-body>
        {featured && flagshipLabel ? (
          <p data-marketing-home-featured-flagship-label>{flagshipLabel}</p>
        ) : null}
        <h3>
          <Link href={detailHref}>{title}</Link>
        </h3>
        {datesLine ? <p data-marketing-home-featured-meta>{datesLine}</p> : null}
        {priceLine ? <p data-marketing-home-featured-price>{priceLine}</p> : null}
        {featured ? (
          <Link href={detailHref} data-marketing-home-featured-cta>
            {t("home.full.featured.viewProgram")}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
