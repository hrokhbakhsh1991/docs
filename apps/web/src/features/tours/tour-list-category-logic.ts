import { DENALI_TOUR_KIND_VALUES } from "@/wizard/denali/denali-tour-kind-labels";

export const TOUR_CATEGORY_FILTER_ALL = "all" as const;

export type TourCategoryFilter = typeof TOUR_CATEGORY_FILTER_ALL | (typeof DENALI_TOUR_KIND_VALUES)[number];

export const TOUR_CATEGORY_FILTER_OPTIONS = [
  TOUR_CATEGORY_FILTER_ALL,
  ...DENALI_TOUR_KIND_VALUES,
] as const;

export function isDenaliTourCategory(value: string | null): value is (typeof DENALI_TOUR_KIND_VALUES)[number] {
  if (value === null) {
    return false;
  }
  return (DENALI_TOUR_KIND_VALUES as readonly string[]).includes(value);
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
