import type { CatalogListFilters } from "./catalog-list-query";
import {
  DENALI_MARKETING_CATEGORY_GROUPS,
  DENALI_MARKETING_DIFFICULTY_LEVELS,
  DENALI_MARKETING_FITNESS_LEVELS,
  isDenaliMarketingPlugin,
} from "@app-tour/workspace-denali/marketing";
import type { MarketingCatalogCard } from "./catalog-types";

export type CatalogFilterOptions = {
  readonly categories: readonly string[];
  readonly difficulties: readonly number[];
  readonly fitnessLevels: readonly string[];
};

export type DeriveCatalogFilterOptionsInput = {
  readonly pluginId: string;
  readonly items: readonly MarketingCatalogCard[];
  readonly activeFilters?: Pick<CatalogListFilters, "category" | "difficulty" | "fitness">;
};

function isDeriveCatalogFilterOptionsInput(
  value: readonly MarketingCatalogCard[] | DeriveCatalogFilterOptionsInput
): value is DeriveCatalogFilterOptionsInput {
  return !Array.isArray(value) && "items" in value;
}

function deriveDenaliFilterOptions(
  activeFilters?: Pick<CatalogListFilters, "category" | "difficulty" | "fitness">
): CatalogFilterOptions {
  const categories = new Set<string>(DENALI_MARKETING_CATEGORY_GROUPS);
  const activeCategory = activeFilters?.category?.trim();
  if (activeCategory != null && activeCategory.length > 0) {
    categories.add(activeCategory);
  }

  return {
    categories: [...categories],
    difficulties: [...DENALI_MARKETING_DIFFICULTY_LEVELS],
    fitnessLevels: [...DENALI_MARKETING_FITNESS_LEVELS],
  };
}

function deriveDynamicFilterOptions(
  items: readonly MarketingCatalogCard[],
  activeFilters?: Pick<CatalogListFilters, "category" | "difficulty" | "fitness">
): CatalogFilterOptions {
  const categories = new Set<string>();
  const difficulties = new Set<number>();
  const fitnessLevels = new Set<string>();

  for (const item of items) {
    const category = item.category?.trim();
    if (category != null && category.length > 0) {
      categories.add(category);
    }
    if (item.difficultyLevel != null && Number.isFinite(item.difficultyLevel)) {
      difficulties.add(item.difficultyLevel);
    }
    const fitness = item.fitnessLevel?.trim();
    if (fitness != null && fitness.length > 0) {
      fitnessLevels.add(fitness);
    }
  }

  const activeCategory = activeFilters?.category?.trim();
  if (activeCategory != null && activeCategory.length > 0) {
    categories.add(activeCategory);
  }
  if (activeFilters?.difficulty != null) {
    difficulties.add(activeFilters.difficulty);
  }
  const activeFitness = activeFilters?.fitness?.trim();
  if (activeFitness != null && activeFitness.length > 0) {
    fitnessLevels.add(activeFitness);
  }

  return {
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    difficulties: [...difficulties].sort((a, b) => a - b),
    fitnessLevels: [...fitnessLevels].sort((a, b) => a.localeCompare(b)),
  };
}

/** Filter controls — Denali uses admin-aligned fixed options; Urban derives from batch. */
export function deriveCatalogFilterOptions(
  items: readonly MarketingCatalogCard[],
  activeFilters?: Pick<CatalogListFilters, "category" | "difficulty" | "fitness">
): CatalogFilterOptions;
export function deriveCatalogFilterOptions(input: DeriveCatalogFilterOptionsInput): CatalogFilterOptions;
export function deriveCatalogFilterOptions(
  itemsOrInput: readonly MarketingCatalogCard[] | DeriveCatalogFilterOptionsInput,
  activeFilters?: Pick<CatalogListFilters, "category" | "difficulty" | "fitness">
): CatalogFilterOptions {
  if (isDeriveCatalogFilterOptionsInput(itemsOrInput)) {
    if (isDenaliMarketingPlugin(itemsOrInput.pluginId)) {
      return deriveDenaliFilterOptions(itemsOrInput.activeFilters);
    }
    return deriveDynamicFilterOptions(itemsOrInput.items, itemsOrInput.activeFilters);
  }

  return deriveDynamicFilterOptions(itemsOrInput, activeFilters);
}
