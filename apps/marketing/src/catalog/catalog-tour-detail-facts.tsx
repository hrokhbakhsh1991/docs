import { getLocale, getTranslations } from "next-intl/server";

import { resolveCatalogDetailSections } from "@app-tour/workspace-sdk";

import { buildCatalogTourDetailFacts } from "./build-catalog-tour-detail-facts";
import type { MarketingCatalogCard } from "./catalog-types";
import {
  formatCatalogCardDates,
  formatCatalogPrice,
  shouldShowCatalogPrice,
} from "./format-catalog-display";
import { resolveMarketingCatalogSurface } from "./resolve-marketing-catalog-surface";
import { resolveMarketingCatalogCardCategoryLabel } from "./resolve-marketing-catalog-category-label";
import { resolveMarketingCatalogFitnessLabel } from "./resolve-marketing-catalog-fitness-label";
import { resolveCatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";

export type CatalogTourDetailFactsProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
  readonly registrationUrl: string | null;
};

export async function CatalogTourDetailFacts({
  tour,
  pluginId,
  registrationUrl,
}: CatalogTourDetailFactsProps) {
  const sections = resolveCatalogDetailSections(pluginId);
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const registration = resolveCatalogTourRegistrationState(tour, registrationUrl);

  const priceValue = shouldShowCatalogPrice(tour)
    ? formatCatalogPrice(
        tour.priceAmount,
        tour.priceCurrency,
        dateLocale,
        t("detail.priceOnRequest"),
        pluginId,
      )
    : null;

  const capacityValue =
    tour.spotsRemaining != null
      ? t("detail.spotsRemaining", { count: tour.spotsRemaining })
      : tour.totalCapacity != null
        ? t("detail.capacity", { count: tour.totalCapacity })
        : null;

  const fitnessValue =
    sections.fitness && tour.fitnessLevel
      ? resolveMarketingCatalogFitnessLabel(tour.fitnessLevel, t)
      : null;

  const surface = await resolveMarketingCatalogSurface(pluginId);
  const difficultyMax = surface?.difficultyMax ?? 10;

  const difficultyValue =
    sections.difficulty && tour.difficultyLevel != null
      ? t("detail.difficultyShort", {
          level: tour.difficultyLevel,
          max: difficultyMax,
        })
      : null;

  const categoryValue = await resolveMarketingCatalogCardCategoryLabel(tour.category, t, pluginId);

  const facts = buildCatalogTourDetailFacts({
    tour,
    sections,
    factLabels: {
      price: t("detail.facts.price"),
      capacity: t("detail.facts.capacity"),
      dates: t("detail.facts.dates"),
      difficulty: t("detail.facts.difficulty"),
      fitness: t("detail.facts.fitness"),
      category: t("detail.facts.category"),
    },
    priceValue,
    capacityValue,
    datesValue: formatCatalogCardDates(tour, dateLocale, t("detail.datesTba")),
    difficultyValue,
    fitnessValue,
    categoryValue: categoryValue != null && categoryValue.length > 0 ? categoryValue : null,
    isSoldOut: registration.isSoldOut,
    omitMetaLineDuplicates: true,
  });

  if (facts.length === 0) {
    return null;
  }

  return (
    <dl data-marketing-catalog-detail-facts>
      {facts.map((fact) => (
        <div
          key={fact.id}
          data-marketing-catalog-detail-fact={fact.id}
          {...(fact.soldOut ? { "data-marketing-catalog-detail-fact-sold-out": true } : {})}
        >
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
