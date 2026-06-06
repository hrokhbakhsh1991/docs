export const TOUR_FORM_PROFILE_VALUES = [
  "general",
  "mountain_outdoor",
  "nature_trip",
  "urban_event",
  "cinema_event",
  "cultural_tour",
  "denali_pilot",
] as const;

export type TourFormProfile = (typeof TOUR_FORM_PROFILE_VALUES)[number];

export const DEFAULT_TOUR_FORM_PROFILE: TourFormProfile = "general";

const PROFILE_SET = new Set<string>(TOUR_FORM_PROFILE_VALUES);

export function isTourFormProfile(value: unknown): value is TourFormProfile {
  return typeof value === "string" && PROFILE_SET.has(value);
}
