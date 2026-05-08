/**
 * Mirrors backend `tour_lifecycle_status_enum` / OpenAPI `lifecycleStatus` enum.
 */
export type TourLifecycleStatus = "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
export type DifficultyLevel = "easy" | "moderate" | "hard" | "technical";

export interface TourItineraryItem {
  day: number;
  title: string;
  description?: string | null;
  distanceKm?: number | null;
  elevationGainM?: number | null;
}

export interface TourDetailsDto {
  destinationName?: string;
  elevationM?: number;
  difficulty?: DifficultyLevel;
  durationDays?: number;
  meetingPoint?: string;
  requiredGear?: string[];
  itinerary?: TourItineraryItem[];
}

export type TourDetails = TourDetailsDto;

/**
 * Mirrors Nest/OpenAPI `TourResponseDto` (`apps/api/openapi.json` components.schemas.TourResponseDto).
 * JSON uses camelCase. Tour schedule dates are not part of the MVP contract.
 */
export interface TourResponseDto {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  description?: string | null;
  totalCapacity: number;
  acceptedCount: number;
  lifecycleStatus: TourLifecycleStatus;
  chatLink?: string | null;
  costContext?: Record<string, unknown> | null;
  autoAcceptRegistrations?: boolean | null;
  tourType?: "camp" | "mountain" | "city" | "desert" | "other" | null;
  primaryTransportMode?: "bus" | "train" | "plane" | "private_car" | "mixed" | "none" | null;
  details?: TourDetailsDto | null;
}

/**
 * Tour row after client normalization (`mapTourResponseToDto`).
 * Includes optional `communicationLink` as an alias of `chatLink` for existing forms/UI.
 */
export type TourDto = TourResponseDto & {
  communicationLink?: string | null;
};

/** Alias — same shape as {@link TourDto} after mapping. */
export type Tour = TourDto;
