export type TourListCategoryFilterGroup = {
  readonly id: string;
  readonly slugs: readonly string[];
};

export type TourListCategorySurface = {
  readonly tourKindValues: readonly string[];
  readonly filterGroups: readonly TourListCategoryFilterGroup[];
  readonly isTourKindSlug: (value: string | null) => boolean;
  readonly isTourCategoryGroup: (value: string) => boolean;
  readonly resolveTourKindDuration: (category: string | null) => "single_day" | "multi_day" | null;
};
