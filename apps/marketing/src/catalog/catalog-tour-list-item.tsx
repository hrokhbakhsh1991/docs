import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { CatalogCoverImage } from "./catalog-cover-image";
import type { MarketingCatalogCard } from "./catalog-types";
import {
  formatCatalogCardDates,
  formatCatalogCardDescription,
  formatCatalogCardSubtitle,
  formatCatalogPrice,
  shouldShowCatalogPrice,
} from "./format-catalog-display";
import { resolveIntlDateLocale, isAppLocale, type AppLocale } from "@/i18n/routing";

export type CatalogTourListItemProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
};

export async function CatalogTourListItem({ tour, pluginId }: CatalogTourListItemProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const subtitle = formatCatalogCardSubtitle(tour, pluginId);
  const description = formatCatalogCardDescription(tour);

  return (
    <li data-marketing-catalog-card>
      {tour.coverImageUrl ? (
        <Link href={`/tours/${tour.id}`} data-marketing-catalog-card-cover>
          <CatalogCoverImage
            src={tour.coverImageUrl}
            alt={tour.title || t("detail.untitled")}
            width={320}
            height={180}
          />
        </Link>
      ) : null}
      <Link href={`/tours/${tour.id}`}>
        <strong>{tour.title || t("detail.untitled")}</strong>
      </Link>
      {description ? <p>{description}</p> : null}
      <p>
        {[subtitle, formatCatalogCardDates(tour, dateLocale, t("detail.datesTba"))]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {tour.spotsRemaining != null ? (
        <p>{t("detail.spotsRemaining", { count: tour.spotsRemaining })}</p>
      ) : tour.totalCapacity != null ? (
        <p>{t("detail.capacity", { count: tour.totalCapacity })}</p>
      ) : null}
      {shouldShowCatalogPrice(pluginId, tour.priceAmount) ? (
        <p>{formatCatalogPrice(tour.priceAmount, tour.priceCurrency, dateLocale, t("detail.priceOnRequest"))}</p>
      ) : null}
      {tour.difficultyLevel != null ? (
        <p>{t("detail.difficulty", { level: tour.difficultyLevel })}</p>
      ) : null}
      {tour.fitnessLevel ? <p>{t("detail.fitness", { level: tour.fitnessLevel })}</p> : null}
    </li>
  );
}
