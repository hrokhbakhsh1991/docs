import type { DenaliTourCategory } from "./denaliCanonicalBasicsControl";

/** Altitude is shown/required for mountain-category tours only (not theme-driven). */
export function isDenaliAltitudeVisibleForCategory(
  category: DenaliTourCategory | undefined,
): boolean {
  return category === "mountain";
}

/** @deprecated Use {@link isDenaliAltitudeVisibleForCategory}. */
export function isDenaliAltitudeVisibleForThemeProfile(
  _formProfile: unknown,
  category: DenaliTourCategory | undefined,
): boolean {
  return isDenaliAltitudeVisibleForCategory(category);
}
