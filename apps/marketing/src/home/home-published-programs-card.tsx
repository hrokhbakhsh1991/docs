import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { CatalogCoverImage } from "@/catalog/catalog-cover-image";
import type { MarketingCatalogCard } from "@/catalog/catalog-types";
import {
  formatCatalogCardDates,
  formatCatalogPrice,
  shouldShowCatalogPrice,
} from "@/catalog/format-catalog-display";
import { resolveCatalogPriceDisplay } from "@/catalog/resolve-catalog-price-display";
import {
  isAppLocale,
  resolveIntlDateLocale,
  resolveMarketingTourDetailPath,
  type AppLocale,
} from "@/i18n/routing";

import { resolveHomeTourCoverUrl } from "./resolve-home-tour-cover-url";

export type HomePublishedProgramsCardProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
};

export async function HomePublishedProgramsCard({
  tour,
  pluginId,
}: HomePublishedProgramsCardProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const priceDisplayPolicy = resolveCatalogPriceDisplay(pluginId);
  const detailHref = resolveMarketingTourDetailPath(tour.id, locale);
  const title = tour.title?.trim() || t("detail.untitled");
  const datesLine = formatCatalogCardDates(tour, dateLocale, t("detail.datesTba"));
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
  const hasCatalogCover = Boolean(tour.coverImageUrl?.trim());

  return (
    <article data-marketing-home-programs-card>
      <Link href={detailHref} data-marketing-home-programs-card-link>
        <figure
          data-marketing-home-programs-cover
          {...(!hasCatalogCover ? { "data-marketing-home-programs-cover-fallback": true } : {})}
        >
          <CatalogCoverImage src={coverSrc} alt="" width={640} height={360} cover />
        </figure>
        <div data-marketing-home-programs-card-body>
          <h3>{title}</h3>
          {datesLine ? <p data-marketing-home-programs-meta>{datesLine}</p> : null}
          {priceLine ? <p data-marketing-home-programs-price>{priceLine}</p> : null}
        </div>
      </Link>
    </article>
  );
}
