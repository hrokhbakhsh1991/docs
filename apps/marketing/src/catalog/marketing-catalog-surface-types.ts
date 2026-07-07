export type MarketingCategoryGroup = "mountain" | "nature";

export type MarketingCatalogTourSlice = {
  readonly gearItems?: readonly unknown[] | null;
  readonly includedServices?: readonly unknown[] | null;
  readonly excludedServices?: readonly unknown[] | null;
  readonly includesTourInsurance?: boolean | null;
  readonly gatheringPoint?: { readonly label?: string | null } | null;
  readonly meetingPointText?: string | null;
  readonly approximateReturnTime?: string | null;
  readonly transport?: {
    readonly mode?: string | null;
    readonly transportCostAmount?: number | null;
    readonly dongAmount?: number | null;
    readonly allowPersonalCar?: boolean | null;
  } | null;
  readonly hikingHoursApprox?: number | null;
  readonly hikingGoHours?: number | null;
  readonly hikingReturnHours?: number | null;
  readonly peakHeightMeters?: number | null;
  readonly trailDistanceKm?: number | null;
  readonly elevationGainMeters?: number | null;
  readonly minimumAge?: number | null;
  readonly maximumAge?: number | null;
  readonly fitnessPrerequisiteText?: string | null;
};

export type MarketingCatalogDetailPdpGates = {
  readonly showHeroGallery: boolean;
  readonly showReadiness: boolean;
  readonly showLogistics: boolean;
  readonly showGear: boolean;
  readonly showGalleryNav: boolean;
  readonly showRegisterPreview: boolean;
  readonly showFaq: boolean;
};

export type MarketingCatalogSurface = {
  readonly categoryGroups: readonly MarketingCategoryGroup[];
  readonly difficultyLevels: readonly number[];
  readonly fitnessLevels: readonly string[];
  readonly difficultyMax: number;
  isCategoryGroup(value: string): value is MarketingCategoryGroup;
  matchesCategoryFilter(
    tourCategory: string | null | undefined,
    filterCategory: string
  ): boolean;
  snapDifficultyLevel(value: number): number;
  resolveCategoryFamily(category: string | null | undefined): MarketingCategoryGroup | null;
  resolveDetailPdpGates(input: {
    readonly tour: MarketingCatalogTourSlice;
    readonly hasOverflowGallery: boolean;
    readonly hasRegisterPreview: boolean;
  }): MarketingCatalogDetailPdpGates;
};
