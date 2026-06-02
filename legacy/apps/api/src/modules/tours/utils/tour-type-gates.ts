import { getTourFormProfileDescriptor, type TourFormProfile } from "@repo/types";

import type { TourTripDetails } from "../types/tour-trip-details.types";

/**
 * Returns a structurally cleaned `tripDetails` JSON with mountain-only overview keys
 * (see `getTourFormProfileDescriptor(profile).invariants.mountainOverviewKeysToStripFromOverview`)
 * stripped when the resolved form profile does not allow mountain-only data. Pure: never
 * mutates the input.
 *
 * Validation contract: in the DTO these fields stay `@IsOptional()`, so they
 * silently disappear (instead of failing validation) when sent for the wrong
 * profile. This keeps the API forgiving toward older clients while still
 * enforcing the policy.
 *
 * Phase P4 (promptq.md): the legacy `applyTourTypeFieldGates(td, tourType)` helper has
 * been retired. All write paths must resolve the {@link TourFormProfile} first (server
 * does this via `resolveWorkspaceTourFormProfile`) and call this function.
 *
 * Phase P10+ housekeeping: the key list is read from the declarative profile descriptor
 * (`packages/types/src/tour-form-profile-descriptors.ts`) — parity-tested against
 * `MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS`.
 */
export function applyMountainOverviewFieldGatesForFormProfile(
  profile: TourFormProfile,
  tripDetails: TourTripDetails | null | undefined,
): TourTripDetails | null | undefined {
  const keysToStrip =
    getTourFormProfileDescriptor(profile).invariants.mountainOverviewKeysToStripFromOverview;
  if (tripDetails == null || keysToStrip.length === 0) {
    return tripDetails;
  }

  const overview = tripDetails.overview;
  if (!overview || typeof overview !== "object") {
    return tripDetails;
  }

  let nextOverview: Record<string, unknown> | undefined;
  for (const key of keysToStrip) {
    if ((overview as Record<string, unknown>)[key] === undefined) continue;
    if (!nextOverview) nextOverview = { ...(overview as Record<string, unknown>) };
    delete nextOverview[key];
  }

  if (!nextOverview) return tripDetails;
  const cleanedOverview = Object.keys(nextOverview).length > 0 ? nextOverview : undefined;
  return { ...tripDetails, overview: cleanedOverview as TourTripDetails["overview"] };
}
