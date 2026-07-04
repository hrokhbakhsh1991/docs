import type { MarketingCatalogCard } from "./catalog-types";
import { DENALI_MARKETING_DIFFICULTY_MAX } from "./denali-catalog-filter-config";
import { isDenaliMarketingPlugin } from "./resolve-marketing-denali-plugin";
import { resolveMarketingCatalogFitnessLevelLabel } from "./resolve-marketing-catalog-fitness-label";

/** Whole-day span between departure and end (minimum 1). */
export function computeCatalogTourDurationDays(
  departureAt: string | null | undefined,
  endAt: string | null | undefined
): number | null {
  if (departureAt == null || departureAt.trim().length === 0) {
    return null;
  }
  const startMs = Date.parse(departureAt);
  if (!Number.isFinite(startMs)) {
    return null;
  }
  if (endAt == null || endAt.trim().length === 0) {
    return 1;
  }
  const endMs = Date.parse(endAt);
  if (!Number.isFinite(endMs) || endMs < startMs) {
    return 1;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((endMs - startMs) / dayMs));
}

function readDurationDaysFromCategory(category: string | null | undefined): number | null {
  const slug = category?.trim() ?? "";
  if (slug.endsWith("_day")) {
    return 1;
  }
  if (slug.endsWith("_multi")) {
    return null;
  }
  return null;
}

export type BuildCatalogListCardSummaryOptions = {
  readonly pluginId: string;
};

/**
 * Scannable at-a-glance line for list cards (Viator/Arival pattern):
 * duration · difficulty · fitness · capacity — not admin long-form copy.
 */
export function buildCatalogListCardSummary(
  tour: MarketingCatalogCard,
  translate: (key: string, values?: Record<string, string | number>) => string,
  options: BuildCatalogListCardSummaryOptions
): string | null {
  if (!isDenaliMarketingPlugin(options.pluginId)) {
    return null;
  }

  const parts: string[] = [];

  const durationDays =
    computeCatalogTourDurationDays(tour.departureAt, tour.endAt) ??
    readDurationDaysFromCategory(tour.category);
  if (durationDays === 1) {
    parts.push(translate("list.card.summary.singleDay"));
  } else if (durationDays != null && durationDays > 1) {
    parts.push(translate("list.card.summary.multiDay", { days: durationDays }));
  }

  if (tour.difficultyLevel != null && Number.isFinite(tour.difficultyLevel)) {
    parts.push(
      translate("list.card.summary.difficulty", {
        level: tour.difficultyLevel,
        max: DENALI_MARKETING_DIFFICULTY_MAX,
      })
    );
  }

  const fitnessLabel = resolveMarketingCatalogFitnessLevelLabel(tour.fitnessLevel, translate);
  if (fitnessLabel != null) {
    parts.push(fitnessLabel);
  }

  if (tour.spotsRemaining != null && tour.spotsRemaining > 0 && tour.spotsRemaining <= 5) {
    parts.push(translate("list.card.summary.openSpots", { count: tour.spotsRemaining }));
  } else if (tour.totalCapacity != null && tour.totalCapacity > 0) {
    parts.push(translate("list.card.summary.capacity", { count: tour.totalCapacity }));
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
