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

export type HomeLatestTourCardProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
};

export async function HomeLatestTourCard({ tour, pluginId: _pluginId }: HomeLatestTourCardProps) {
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
    <article data-marketing-home-latest-card>
      <figure
        data-marketing-home-latest-cover
        {...(!hasCatalogCover ? { "data-marketing-home-latest-cover-fallback": true } : {})}
      >
        <Link href={detailHref}>
          <CatalogCoverImage
            src={coverSrc}
            alt={title}
            width={640}
            height={360}
            cover
          />
        </Link>
      </figure>
      <div>
        <h3>
          <Link href={detailHref}>{title}</Link>
        </h3>
        {datesLine ? <p data-marketing-home-latest-meta>{datesLine}</p> : null}
        {priceLine ? <p data-marketing-home-latest-price>{priceLine}</p> : null}
      </div>
    </article>
  );
}
