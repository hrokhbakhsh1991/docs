/**
 * Single source of truth for Postgres `tour_type_enum` and API/web tour classification.
 */

export const TOUR_TYPES = [
  "mountain",
  "city",
  "desert",
  "nature",
  "cultural"
] as const;

export type TourType = typeof TOUR_TYPES[number];
