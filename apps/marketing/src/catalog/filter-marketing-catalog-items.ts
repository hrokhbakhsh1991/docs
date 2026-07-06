import type { CatalogListFilters } from "./catalog-list-query";
import {
  matchesDenaliMarketingCategoryFilter,
  snapDenaliCatalogDifficultyLevel,
} from "@app-tour/workspace-denali/marketing";
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
export function filterMarketingCatalogItems(
  items: readonly MarketingCatalogCard[],
  filters: Pick<
    CatalogListFilters,
    "q" | "category" | "difficulty" | "fitness" | "availability"
  >
): readonly MarketingCatalogCard[] {
  let filtered = items;

  const category = filters.category?.trim();
  if (category != null && category.length > 0) {
    filtered = filtered.filter((item) => matchesDenaliMarketingCategoryFilter(item.category, category));
  }

  if (filters.difficulty != null) {
    const target = snapDenaliCatalogDifficultyLevel(filters.difficulty);
    filtered = filtered.filter((item) => {
      if (item.difficultyLevel == null) {
        return false;
      }
      return snapDenaliCatalogDifficultyLevel(item.difficultyLevel) === target;
    });
  }

  const fitness = filters.fitness?.trim();
  if (fitness != null && fitness.length > 0) {
    filtered = filtered.filter((item) => item.fitnessLevel?.trim() === fitness);
  }

  filtered = filtered.filter((item) => matchesAvailability(item, filters.availability));

  const query = filters.q?.trim().toLowerCase();
  if (query != null && query.length > 0) {
    filtered = filtered.filter((item) => readSearchHaystack(item).includes(query));
  }

  return filtered;
}
