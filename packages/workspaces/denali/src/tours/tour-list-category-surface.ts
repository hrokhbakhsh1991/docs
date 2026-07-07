import {
  DENALI_TOUR_CATEGORY_VALUES,
  DENALI_TOUR_KIND_VALUES,
  type DenaliTourCategorySlug,
  type DenaliTourDurationSlug,
} from "../ui/logic/denali-tour-kind-labels";

export type DenaliTourListCategoryFilterGroup = {
  readonly id: DenaliTourCategorySlug;
  readonly slugs: readonly (typeof DENALI_TOUR_KIND_VALUES)[number][];
};

const DENALI_TOUR_CATEGORY_FILTER_GROUPS: readonly DenaliTourListCategoryFilterGroup[] = [
  {
    id: "mountain",
    slugs: ["mountain_day", "mountain_multi"],
  },
  {
    id: "nature",
    slugs: ["nature_day", "nature_multi"],
  },
  {
    id: "desert",
    slugs: ["desert_day", "desert_multi"],
  },
  {
    id: "event",
    slugs: ["event_reading", "event_reading_multi", "event_cinema", "event_cinema_multi"],
  },
] as const;

export type DenaliTourListCategorySurface = {
  readonly tourKindValues: typeof DENALI_TOUR_KIND_VALUES;
  readonly filterGroups: typeof DENALI_TOUR_CATEGORY_FILTER_GROUPS;
  readonly isTourKindSlug: (value: string | null) => value is (typeof DENALI_TOUR_KIND_VALUES)[number];
  readonly isTourCategoryGroup: (value: string) => value is DenaliTourCategorySlug;
  readonly resolveTourKindDuration: (category: string | null) => DenaliTourDurationSlug | null;
};

function isTourKindSlug(
  value: string | null
): value is (typeof DENALI_TOUR_KIND_VALUES)[number] {
  if (value === null) {
    return false;
  }
  return (DENALI_TOUR_KIND_VALUES as readonly string[]).includes(value);
}

function isTourCategoryGroup(value: string): value is DenaliTourCategorySlug {
  return (DENALI_TOUR_CATEGORY_VALUES as readonly string[]).includes(value);
}

function resolveTourKindDuration(category: string | null): DenaliTourDurationSlug | null {
  if (!isTourKindSlug(category)) {
    return null;
  }
  return category.endsWith("_multi") ? "multi_day" : "single_day";
}

export const denaliTourListCategorySurface: DenaliTourListCategorySurface = Object.freeze({
  tourKindValues: DENALI_TOUR_KIND_VALUES,
  filterGroups: DENALI_TOUR_CATEGORY_FILTER_GROUPS,
  isTourKindSlug,
  isTourCategoryGroup,
  resolveTourKindDuration,
});
