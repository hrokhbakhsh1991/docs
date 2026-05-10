import type { TourType } from "../entities/tour.entity";
import type { TourTripDetails } from "../types/tour-trip-details.types";

/**
 * Trip-detail fields that are conceptually meaningful only for mountain tours.
 * Server-side guards strip these fields when the tour's `tourType` is not
 * `mountain`, mirroring the UI's `hidden` configuration in
 * `apps/web/src/features/tours/config/tripDetailsFieldConfig.ts`.
 */
const MOUNTAIN_ONLY_OVERVIEW_KEYS = ["maxAltitudeMeters"] as const;

/**
 * Returns a structurally cleaned `tripDetails` JSON with mountain-only fields
 * stripped when `tourType` is not `mountain`. Pure: never mutates the input.
 *
 * Validation contract: in the DTO these fields stay `@IsOptional()`, so they
 * silently disappear (instead of failing validation) when sent for the wrong
 * `tourType`. This keeps the API forgiving toward older clients while still
 * enforcing the policy.
 */
export function applyTourTypeFieldGates(
  tripDetails: TourTripDetails | null | undefined,
  tourType: TourType | null | undefined,
): TourTripDetails | null | undefined {
  if (tripDetails == null || tourType === "mountain") {
    return tripDetails;
  }

  const overview = tripDetails.overview;
  if (!overview || typeof overview !== "object") {
    return tripDetails;
  }

  let nextOverview: Record<string, unknown> | undefined;
  for (const key of MOUNTAIN_ONLY_OVERVIEW_KEYS) {
    if ((overview as Record<string, unknown>)[key] === undefined) continue;
    if (!nextOverview) nextOverview = { ...(overview as Record<string, unknown>) };
    delete nextOverview[key];
  }

  if (!nextOverview) return tripDetails;
  const cleanedOverview = Object.keys(nextOverview).length > 0 ? nextOverview : undefined;
  return { ...tripDetails, overview: cleanedOverview as TourTripDetails["overview"] };
}
