import {
  DENALI_TOUR_CATEGORY_VALUES,
  DENALI_TOUR_KIND_VALUES,
  type DenaliTourCategorySlug,
  type DenaliTourDurationSlug,
} from "@app-tour/workspace-denali/ui/logic/denali-tour-kind-labels";

export const TOUR_CATEGORY_FILTER_ALL = "all" as const;

export type TourCategoryFilter = typeof TOUR_CATEGORY_FILTER_ALL | (typeof DENALI_TOUR_KIND_VALUES)[number];

export const TOUR_CATEGORY_FILTER_OPTIONS = [
  TOUR_CATEGORY_FILTER_ALL,
  ...DENALI_TOUR_KIND_VALUES,
] as const;

export type TourCategoryFilterGroup = {
  readonly id: DenaliTourCategorySlug;
  readonly slugs: readonly (typeof DENALI_TOUR_KIND_VALUES)[number][];
};

/** Denali-only grouped chips — URL still uses flat `category=` slugs. */
export const TOUR_CATEGORY_FILTER_GROUPS: readonly TourCategoryFilterGroup[] = [
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

export function isDenaliTourCategory(value: string | null): value is (typeof DENALI_TOUR_KIND_VALUES)[number] {
  if (value === null) {
    return false;
  }
  return (DENALI_TOUR_KIND_VALUES as readonly string[]).includes(value);
}

export function isDenaliTourCategoryGroup(value: string): value is DenaliTourCategorySlug {
  return (DENALI_TOUR_CATEGORY_VALUES as readonly string[]).includes(value);
}

export function resolveDenaliTourKindDuration(
  category: string | null
): DenaliTourDurationSlug | null {
  if (!isDenaliTourCategory(category)) {
    return null;
  }
  return category.endsWith("_multi") ? "multi_day" : "single_day";
}

export function matchesTourCategoryFilter(
  category: string | null,
  filter: TourCategoryFilter
): boolean {
  if (filter === TOUR_CATEGORY_FILTER_ALL) {
    return true;
  }
  return category === filter;
}
