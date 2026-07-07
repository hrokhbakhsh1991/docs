/** Human labels for Denali `basicInfo.tourType` slugs (category × duration × event variant). */

export const DENALI_TOUR_KIND_VALUES = [
  "mountain_day",
  "mountain_multi",
  "nature_day",
  "nature_multi",
  "desert_day",
  "desert_multi",
  "event_reading",
  "event_reading_multi",
  "event_cinema",
  "event_cinema_multi",
] as const;

export const DENALI_TOUR_CATEGORY_VALUES = ["mountain", "nature", "desert", "event"] as const;

export type DenaliTourCategorySlug = (typeof DENALI_TOUR_CATEGORY_VALUES)[number];

export const DENALI_TOUR_DURATION_VALUES = ["single_day", "multi_day"] as const;

export type DenaliTourDurationSlug = (typeof DENALI_TOUR_DURATION_VALUES)[number];

export const DENALI_EVENT_VARIANT_VALUES = ["reading", "cinema"] as const;

export type DenaliEventVariantSlug = (typeof DENALI_EVENT_VARIANT_VALUES)[number];

export function denaliCategoryRequiresEventVariant(category: DenaliTourCategorySlug): boolean {
  return category === "event";
}
