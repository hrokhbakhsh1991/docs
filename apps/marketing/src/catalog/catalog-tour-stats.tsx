import { getLocale, getTranslations } from "next-intl/server";

import { resolveCatalogDetailSections } from "@app-tour/workspace-sdk";

import type { MarketingCatalogCard } from "./catalog-types";
import {
  formatCatalogPrice,
  shouldShowCatalogPrice,
} from "./format-catalog-display";
import { resolveMarketingCatalogSurface } from "./resolve-marketing-catalog-surface";
import { resolveMarketingCatalogFitnessLabel } from "./resolve-marketing-catalog-fitness-label";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";

export type CatalogTourStatsProps = {
  readonly tour: MarketingCatalogCard;
  readonly testId: "card" | "detail";
  readonly pluginId: string;
  /** PR-21 card cover already shows price/capacity — omit duplicate pills on list cards. */
  readonly omitOverlayFields?: boolean;
};

export async function CatalogTourStats({
  tour,
  testId,
  pluginId,
  omitOverlayFields = false,
}: CatalogTourStatsProps) {
  const sections = resolveCatalogDetailSections(pluginId);
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const showPrice = shouldShowCatalogPrice(tour) && !omitOverlayFields;
  const capacityLabel =
    !omitOverlayFields &&
    (tour.spotsRemaining != null
      ? t("detail.spotsRemaining", { count: tour.spotsRemaining })
      : tour.totalCapacity != null
        ? t("detail.capacity", { count: tour.totalCapacity })
        : null);

  const fitnessLabel =
    sections.fitness && tour.fitnessLevel
      ? resolveMarketingCatalogFitnessLabel(tour.fitnessLevel, t)
      : null;

  const hasStats =
    capacityLabel != null ||
    showPrice ||
    (sections.difficulty && tour.difficultyLevel != null) ||
    fitnessLabel != null;

  if (!hasStats) {
    return null;
  }

  const statsProps =
    testId === "card"
      ? ({ "data-marketing-catalog-card-stats": true } as const)
      : ({ "data-marketing-catalog-detail-stats": true } as const);

  const surface = await resolveMarketingCatalogSurface(pluginId);
  const difficultyMax = surface?.difficultyMax ?? 10;

  return (
    <ul {...statsProps}>
      {capacityLabel ? <li>{capacityLabel}</li> : null}
      {showPrice ? (
        <li>
          {formatCatalogPrice(
            tour.priceAmount,
            tour.priceCurrency,
            dateLocale,
            t("detail.priceOnRequest"),
          )}
        </li>
      ) : null}
      {sections.difficulty && tour.difficultyLevel != null ? (
        <li>
          {t("detail.difficulty", {
            level: tour.difficultyLevel,
            max: difficultyMax,
          })}
        </li>
      ) : null}
      {fitnessLabel ? <li data-marketing-catalog-stat-fitness>{fitnessLabel}</li> : null}
    </ul>
  );
}
