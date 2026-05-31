import { stripTripDetailsForFormProfile as stripTripDetailsForFormProfileShared } from "@repo/shared-contracts";
import { type TourFormProfile } from "@repo/types";

import type { TourTripDetails } from "@/features/tours/models/tourTripDetails.schema";

/**
 * Client tripDetails profile strip — delegates to the shared contract in `@repo/shared-contracts`.
 */
export function stripTourFormTripDetailsForFormProfile(
  profile: TourFormProfile,
  tripDetails: TourTripDetails | null | undefined,
): TourTripDetails | undefined {
  return stripTripDetailsForFormProfileShared(
    profile,
    tripDetails as Record<string, unknown> | null | undefined,
  ) as TourTripDetails | undefined;
}
