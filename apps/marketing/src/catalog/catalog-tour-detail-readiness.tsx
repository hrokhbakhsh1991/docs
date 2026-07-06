import { getLocale, getTranslations } from "next-intl/server";

import { buildCatalogReadinessCells } from "./build-catalog-readiness-cells";
import type { MarketingCatalogCard } from "./catalog-types";
import { resolveMarketingCatalogSurface } from "./resolve-marketing-catalog-surface";
import { isAppLocale, type AppLocale } from "@/i18n/routing";
import { toLocalizedDigits } from "@/i18n/format-localized-digits";

export type CatalogTourDetailReadinessProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
};

export async function CatalogTourDetailReadiness({
  tour,
  pluginId,
}: CatalogTourDetailReadinessProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const localizeNumber = (value: number) =>
    toLocalizedDigits(String(value), locale);

  const surface = resolveMarketingCatalogSurface(pluginId);
  const cells = buildCatalogReadinessCells({
    tour,
    family: surface?.resolveCategoryFamily(tour.category) ?? null,
    labels: {
      hikingHours: t("detail.readiness.hikingHours"),
      hikingGoHours: t("detail.readiness.hikingGoHours"),
      hikingReturnHours: t("detail.readiness.hikingReturnHours"),
      peakHeight: t("detail.readiness.peakHeight"),
      trailDistance: t("detail.readiness.trailDistance"),
      elevationGain: t("detail.readiness.elevationGain"),
      minimumAge: t("detail.readiness.minimumAge"),
      maximumAge: t("detail.readiness.maximumAge"),
    },
    formatHours: (hours) => t("detail.readiness.hoursValue", { hours: localizeNumber(hours) }),
    formatMeters: (meters) => t("detail.readiness.metersValue", { meters: localizeNumber(meters) }),
    formatKilometers: (km) => t("detail.readiness.kilometersValue", { km: localizeNumber(km) }),
    formatAge: (years) => t("detail.readiness.ageValue", { years: localizeNumber(years) }),
  });

  if (cells.length === 0 && !tour.fitnessPrerequisiteText?.trim()) {
    return null;
  }

  return (
    <section data-marketing-catalog-detail-readiness id="catalog-detail-readiness">
      <h2>{t("detail.readiness.heading")}</h2>
      {cells.length > 0 ? (
        <dl data-marketing-catalog-detail-readiness-grid>
          {cells.map((cell) => (
            <div key={cell.id} data-marketing-catalog-detail-readiness-cell={cell.id}>
              <dt>{cell.label}</dt>
              <dd>{cell.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {tour.fitnessPrerequisiteText?.trim() ? (
        <p data-marketing-catalog-detail-fitness-prerequisite>
          {toLocalizedDigits(tour.fitnessPrerequisiteText.trim(), locale)}
        </p>
      ) : null}
    </section>
  );
}
