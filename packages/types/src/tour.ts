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

export interface TourTripDetailsLogistics {
  meetingPoint?: string;
  departureMeetingTime?: string;
  departureDate?: string;
  returnDate?: string;
  returnPoint?: string;
  transportation?: string;
  accommodationType?: string;
  mealPlan?: string;
  supportServices?: string[];
  includedServices?: string[];
  excludedServices?: string[];
  optionalServices?: string[];
  guideLanguage?: string[];
  groupSizeMin?: number;
  groupSizeMax?: number;
}

export type TripDetailsExperienceLevel = "none" | "basic" | "intermediate" | "advanced";
export type TripDetailsGenderRestriction = "none" | "male_only" | "female_only";

export interface TourTripDetailsParticipation {
  minimumAge?: number;
  maximumAge?: number;
  genderRestriction?: TripDetailsGenderRestriction;
  difficultyLevel?: DifficultyLevel;
  fitnessLevel?: DifficultyLevel;
  experienceLevel?: TripDetailsExperienceLevel;
  medicalRestrictions?: string;
  technicalSkillRequired?: string;
  requirements?: string;
  skillsRequired?: string[];
  gearRequired?: string[];
  gearOptional?: string[];
  documentsRequired?: string[];
  suitableFor?: string[];
  notSuitableFor?: string[];
}

export interface TourTripDetails {
  schemaVersion?: number;
  overview?: Record<string, unknown>;
  itinerary?: Record<string, unknown>;
  participation?: TourTripDetailsParticipation;
  logistics?: TourTripDetailsLogistics;
  policies?: Record<string, unknown>;
}

export interface TourDetailsDto {
  destinationName?: string;
  elevationM?: number;
  difficulty?: DifficultyLevel;
  durationDays?: number;
  meetingPoint?: string;
  requiredGear?: string[];
  itinerary?: TourItineraryItem[];
  /** Structured trip details (JSONB). Mirrors API `details.tripDetails`. */
  tripDetails?: TourTripDetails | null;
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
