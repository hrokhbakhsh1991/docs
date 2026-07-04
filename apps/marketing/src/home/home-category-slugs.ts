/** Denali tour-kind slugs mirrored for marketing category chip labels (canonical `category`). */
export const HOME_CATEGORY_SLUGS = [
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

export type HomeCategorySlug = (typeof HOME_CATEGORY_SLUGS)[number];
