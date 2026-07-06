import {
  DENALI_MARKETING_CATEGORY_GROUPS,
  DENALI_MARKETING_DIFFICULTY_LEVELS,
  DENALI_MARKETING_DIFFICULTY_MAX,
  DENALI_MARKETING_FITNESS_LEVELS,
  isDenaliMarketingCategoryGroup,
  matchesDenaliMarketingCategoryFilter,
  snapDenaliCatalogDifficultyLevel,
  type DenaliMarketingCategoryGroup,
} from "./catalog-filter-config";
import {
  buildDenaliMarketingCatalogDetailPdpGates,
  type CatalogDetailDenaliPdpGates,
  type DenaliMarketingCatalogTour,
  type ResolveDenaliCatalogDetailPdpGatesInput,
} from "./catalog-detail-pdp-gates";
import { resolveDenaliMarketingCategoryFamily } from "./resolve-category-family";

export type DenaliMarketingCatalogSurface = {
  readonly categoryGroups: readonly DenaliMarketingCategoryGroup[];
  readonly difficultyLevels: readonly number[];
  readonly fitnessLevels: readonly string[];
  readonly difficultyMax: number;
  isCategoryGroup(value: string): value is DenaliMarketingCategoryGroup;
  matchesCategoryFilter(
    tourCategory: string | null | undefined,
    filterCategory: string
  ): boolean;
  snapDifficultyLevel(value: number): number;
  resolveCategoryFamily(category: string | null | undefined): DenaliMarketingCategoryGroup | null;
  resolveDetailPdpGates(
    input: ResolveDenaliCatalogDetailPdpGatesInput
  ): CatalogDetailDenaliPdpGates;
};

export const denaliMarketingCatalogSurface: DenaliMarketingCatalogSurface = Object.freeze({
  categoryGroups: DENALI_MARKETING_CATEGORY_GROUPS,
  difficultyLevels: DENALI_MARKETING_DIFFICULTY_LEVELS,
  fitnessLevels: DENALI_MARKETING_FITNESS_LEVELS,
  difficultyMax: DENALI_MARKETING_DIFFICULTY_MAX,
  isCategoryGroup: isDenaliMarketingCategoryGroup,
  matchesCategoryFilter: matchesDenaliMarketingCategoryFilter,
  snapDifficultyLevel: snapDenaliCatalogDifficultyLevel,
  resolveCategoryFamily: resolveDenaliMarketingCategoryFamily,
  resolveDetailPdpGates(input: {
    readonly tour: DenaliMarketingCatalogTour;
    readonly hasOverflowGallery: boolean;
    readonly hasRegisterPreview: boolean;
  }): CatalogDetailDenaliPdpGates {
    return buildDenaliMarketingCatalogDetailPdpGates(input);
  },
});
