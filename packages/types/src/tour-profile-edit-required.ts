import type { TourFormProfile } from "./tour-form-profile";
import { getTourFormProfileDescriptor } from "./tour-form-profile-descriptors";

/**
 * Edit trip-details field ids (`tripDetailsFieldConfig` row id) required at publish
 * (from `edit.tripDetailsPresetOverrides` where `requiredness === "required"`).
 * Wizard submit-required remains separate — see {@link tour-profile-submit-required}.
 */
export function getEditRequiredTripDetailsPathsForProfile(
  profile: TourFormProfile,
): readonly string[] {
  const rows = getTourFormProfileDescriptor(profile).edit.tripDetailsPresetOverrides;
  return rows
    .filter((row) => row.requiredness === "required")
    .map((row) => row.id)
    .sort((a, b) => a.localeCompare(b));
}
