/**
 * Back-compat shim — Phase P14 (promptq.md follow-up).
 *
 * The canonical authoring location for {@link MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS} (and
 * the matching {@link MountainOnlyTripDetailsOverviewKey} type) is now
 * {@link ./tour-form-profile-descriptors}, where every profile-axis policy decision lives
 * (Phase P10).
 *
 * This module is preserved only so existing imports (`@repo/types` callers + parity specs)
 * keep resolving. New code should import from `tour-form-profile-descriptors` directly or via
 * the package root.
 */
export {
  MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS,
  type MountainOnlyTripDetailsOverviewKey,
} from "./tour-form-profile-descriptors";
