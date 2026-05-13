import { URBAN_LOGISTICS_WHITELIST_KEYS, type TourFormProfile } from "@repo/types";

import type { TourTripDetails } from "@/features/tours/models/tourTripDetails.schema";

/** Canonical single source: {@link URBAN_LOGISTICS_WHITELIST_KEYS} in `@repo/types`. */
const URBAN_LOGISTICS_WHITELIST: ReadonlySet<string> = new Set(URBAN_LOGISTICS_WHITELIST_KEYS);

/**
 * Client mirror of server `stripTripDetailsForFormProfile` for flat `TourForm` / PATCH payloads.
 * Returns a cloned object; does not mutate the input.
 */
export function stripTourFormTripDetailsForFormProfile(
  profile: TourFormProfile,
  tripDetails: TourTripDetails | null | undefined,
): TourTripDetails | undefined {
  if (tripDetails == null || typeof tripDetails !== "object") {
    return tripDetails ?? undefined;
  }
  if (profile !== "cinema_event" && profile !== "urban_event") {
    return tripDetails;
  }

  const root = JSON.parse(JSON.stringify(tripDetails)) as Record<string, unknown>;
  delete root.participation;

  if (root.itinerary != null && typeof root.itinerary === "object") {
    const it = { ...(root.itinerary as Record<string, unknown>) };
    delete it.dayPlans;
    delete it.segmentActivities;
    root.itinerary = it;
  }

  if (profile === "urban_event" && root.logistics != null && typeof root.logistics === "object") {
    const log = root.logistics as Record<string, unknown>;
    const slim: Record<string, unknown> = {};
    for (const key of URBAN_LOGISTICS_WHITELIST) {
      if (log[key] !== undefined) {
        slim[key] = log[key];
      }
    }
    root.logistics = slim;
  }

  return root as TourTripDetails;
}
