import { getTourFormProfileDescriptor, type TourFormProfile } from "@repo/types";

import type { TourTripDetails } from "@/features/tours/models/tourTripDetails.schema";

/**
 * Client mirror of server `stripTripDetailsForFormProfile` for flat `TourForm` / PATCH payloads.
 * Strip deltas come from {@link getTourFormProfileDescriptor} (`descriptor.strip`).
 * Returns a cloned object; does not mutate the input.
 */
export function stripTourFormTripDetailsForFormProfile(
  profile: TourFormProfile,
  tripDetails: TourTripDetails | null | undefined,
): TourTripDetails | undefined {
  if (tripDetails == null || typeof tripDetails !== "object") {
    return tripDetails ?? undefined;
  }

  const { strip } = getTourFormProfileDescriptor(profile);
  if (
    strip.clearsTripDetailsRoots.length === 0 &&
    strip.itineraryKeysToDelete.length === 0 &&
    strip.logisticsWhitelist == null
  ) {
    return tripDetails;
  }

  const root = JSON.parse(JSON.stringify(tripDetails)) as Record<string, unknown>;

  for (const key of strip.clearsTripDetailsRoots) {
    delete root[key];
  }

  if (
    strip.itineraryKeysToDelete.length > 0 &&
    root.itinerary != null &&
    typeof root.itinerary === "object"
  ) {
    const it = { ...(root.itinerary as Record<string, unknown>) };
    for (const k of strip.itineraryKeysToDelete) {
      delete it[k];
    }
    if (Object.keys(it).length === 0) {
      delete root.itinerary;
    } else {
      root.itinerary = it;
    }
  }

  if (strip.logisticsWhitelist != null && root.logistics != null && typeof root.logistics === "object") {
    const log = root.logistics as Record<string, unknown>;
    const slim: Record<string, unknown> = {};
    for (const key of strip.logisticsWhitelist) {
      if (log[key] !== undefined) {
        slim[key] = log[key];
      }
    }
    root.logistics = slim;
  }

  return root as TourTripDetails;
}
