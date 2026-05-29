import type { TourFormProfile } from "@repo/types";
import type { TourLifecycleStatus } from "@repo/domain-contracts";

import type { DifficultyLevel, TourItineraryItem } from "../types/tour-trip-details.types";
import type { TourTransportMode } from "../tour-transport-modes";
import type { TourTripDetails } from "../types/tour-trip-details.types";

export type TourCapacityPolicySnapshot = {
  lifecycleStatus: TourLifecycleStatus;
  acceptedCount: number;
  totalCapacity: number;
};

export type TourDetailsPolicySnapshot = {
  destinationName?: string | null;
  elevationM?: number | null;
  difficulty?: DifficultyLevel | null;
  durationDays?: number | null;
  meetingPoint?: string | null;
  itinerary?: TourItineraryItem[] | null;
  tripDetails?: TourTripDetails | null;
};

/** Shape used by publish / patch gates (no TypeORM entity). */
export type TourPublishPolicySnapshot = {
  title: string;
  totalCapacity: number;
  acceptedCount: number;
  lifecycleStatus: TourLifecycleStatus;
  formProfileSnapshot?: TourFormProfile | null;
  transportModes?: TourTransportMode[] | null;
  costContext?: Record<string, unknown> | null;
  details?: TourDetailsPolicySnapshot | null;
};
