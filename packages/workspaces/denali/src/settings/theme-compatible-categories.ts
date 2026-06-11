/** Denali tour theme formProfile → compatible tour `category` values (wizard catalog). */
const THEME_PROFILE_CATEGORIES: Readonly<Record<string, readonly string[]>> = {
  denali_pilot: ["mountain", "nature", "desert", "event"],
  mountain_outdoor: ["mountain"],
  nature_trip: ["nature", "desert"],
  urban_event: ["event"],
  cinema_event: ["event"],
  cultural_tour: ["event"],
};

export function resolveThemeCompatibleCategories(
  formProfile: string | null | undefined
): readonly string[] {
  if (formProfile === null || formProfile === undefined) {
    return [];
  }
  const key = formProfile.trim();
  if (key.length === 0) {
    return [];
  }
  return THEME_PROFILE_CATEGORIES[key] ?? [];
}
