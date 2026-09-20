import type { CatalogListFilters } from "./catalog-list-query";
import {
  computeCatalogTourDurationDays,
  readDurationDaysFromCategory,
} from "./build-catalog-list-card-summary";
import { resolveMarketingCatalogSurface } from "./resolve-marketing-catalog-surface";
import type { MarketingCatalogCard } from "./catalog-types";

function readSearchHaystack(item: MarketingCatalogCard): string {
  return [
    item.title,
    item.category,
    item.listDescription,
    item.shortDescription,
    item.catalogSummary,
    item.listSubtitle,
  ]
    .filter((part): part is string => part != null && part.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

const PUBLIC_CATALOG_BLOCKED_TEST_PATTERNS = [
  "hgjghjfghj",
  "تست اعلان تلگرام استیجینگ",
  "سناریوی تست تور پولی",
] as const;

/** Keep known staging/test records out of the public catalog egress. */
export function isPublicCatalogItemAllowed(item: MarketingCatalogCard): boolean {
  const haystack = readSearchHaystack(item);
  return !PUBLIC_CATALOG_BLOCKED_TEST_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function matchesAvailability(
  item: MarketingCatalogCard,
  availability: CatalogListFilters["availability"]
): boolean {
  if (availability !== "open") {
    return true;
  }
  if (item.spotsRemaining == null) {
    return true;
  }
  return item.spotsRemaining > 0;
}

/** Client-side list filters when API has no category/q params (PR-7 / PR-21). */
export async function filterMarketingCatalogItems(
  items: readonly MarketingCatalogCard[],
  filters: Pick<
    CatalogListFilters,
    | "q"
    | "category"
    | "difficulty"
    | "fitness"
    | "availability"
    | "minPrice"
    | "maxPrice"
    | "minDuration"
    | "maxDuration"
  >,
  pluginId?: string
): Promise<readonly MarketingCatalogCard[]> {
  const surface = pluginId != null ? await resolveMarketingCatalogSurface(pluginId) : null;
  let filtered = items.filter(isPublicCatalogItemAllowed);

  const category = filters.category?.trim();
  if (category != null && category.length > 0) {
    filtered = filtered.filter((item) => {
      if (surface != null) {
        return surface.matchesCategoryFilter(item.category, category);
      }
      return item.category?.trim() === category;
    });
  }

  if (filters.difficulty != null) {
    const target = surface?.snapDifficultyLevel(filters.difficulty) ?? filters.difficulty;
    filtered = filtered.filter((item) => {
      if (item.difficultyLevel == null) {
        return false;
      }
      const itemLevel = surface?.snapDifficultyLevel(item.difficultyLevel) ?? item.difficultyLevel;
      return itemLevel === target;
    });
  }

  const fitness = filters.fitness?.trim();
  if (fitness != null && fitness.length > 0) {
    filtered = filtered.filter((item) => item.fitnessLevel?.trim() === fitness);
  }

  filtered = filtered.filter((item) => matchesAvailability(item, filters.availability));

  if (filters.minPrice != null || filters.maxPrice != null) {
    filtered = filtered.filter((item) => {
      if (item.priceAmount == null || !Number.isFinite(item.priceAmount)) {
        return false;
      }
      return (
        (filters.minPrice == null || item.priceAmount >= filters.minPrice) &&
        (filters.maxPrice == null || item.priceAmount <= filters.maxPrice)
      );
    });
  }

  if (filters.minDuration != null || filters.maxDuration != null) {
    filtered = filtered.filter((item) => {
      const duration =
        computeCatalogTourDurationDays(item.departureAt, item.endAt) ??
        readDurationDaysFromCategory(item.category);
      if (duration == null) {
        return false;
      }
      return (
        (filters.minDuration == null || duration >= filters.minDuration) &&
        (filters.maxDuration == null || duration <= filters.maxDuration)
      );
    });
  }

  const query = filters.q?.trim().toLowerCase();
  if (query != null && query.length > 0) {
    filtered = filtered.filter((item) => readSearchHaystack(item).includes(query));
  }

  return filtered;
}
