import { TOUR_FORM_PROFILE_VALUES, type TourFormProfile } from "../tour-form-profile";

/** Settings `next-intl` key under the `settings` namespace for a profile option label. */
export const TOUR_FORM_PROFILE_SETTINGS_LABEL_PREFIX = "tourThemesFormProfileOption_" as const;

export type TourFormProfileOption = {
  readonly value: TourFormProfile;
  readonly labelKey: `${typeof TOUR_FORM_PROFILE_SETTINGS_LABEL_PREFIX}${TourFormProfile}`;
};

/**
 * Ordered profile options for Settings theme/preset pickers.
 * Extend {@link TOUR_FORM_PROFILE_VALUES} once; add matching `settings.tourThemesFormProfileOption_*` i18n.
 */
export function getTourFormProfileOptions(): readonly TourFormProfileOption[] {
  return TOUR_FORM_PROFILE_VALUES.map((value) => ({
    value,
    labelKey: `${TOUR_FORM_PROFILE_SETTINGS_LABEL_PREFIX}${value}`,
  }));
}

/**
 * Tuple for `z.enum()` — same closed set and order as {@link getTourFormProfileOptions}.
 * Implemented as the canonical `TOUR_FORM_PROFILE_VALUES` tuple (options are built from it).
 */
export function getTourFormProfileZodEnumValues(): typeof TOUR_FORM_PROFILE_VALUES {
  return TOUR_FORM_PROFILE_VALUES;
}
