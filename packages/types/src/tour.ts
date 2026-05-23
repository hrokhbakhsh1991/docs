import type { AccommodationTypeSlug } from "./accommodation-types";
import type { MealPlanSlug } from "./meal-plan";
import type { DenaliGatheringPickupStation } from "./denali/gatheringPickupStation";
import type { TourFormProfile } from "./tour-form-profile";
import type { TourType } from "./tour-classification";

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
  /** @deprecated Use `gatheringPoints` array for structured pickup stations. */
  meetingPoint?: string;
  /** @deprecated Favor logistics.gatheringPoints[].time. */
  departureMeetingTime?: string;
  departureDate?: string;
  returnDate?: string;
  /** @deprecated Legacy singular point. */
  returnPoint?: string;
  /** Planned transportation notes (mode, route, operator). */
  transportationNotes?: string;
  /**
   * @deprecated Legacy JSONB key — use `transportationNotes`. Kept until all stored tours are migrated.
   */
  transportation?: string;
  /** Multi-station pickup rows (Denali wizard). */
  gatheringPoints?: DenaliGatheringPickupStation[];
  /** Accommodation categories (multi-select). */
  accommodationTypes?: AccommodationTypeSlug[];
  /** Extra accommodation context (not covered by fixed types). */
  accommodationNotes?: string;
  /**
   * @deprecated Legacy free-text `accommodationType`. Use `accommodationTypes` + `accommodationNotes`.
   */
  accommodationType?: string;
  /** Included meals (single choice). */
  mealPlan?: MealPlanSlug;
  /** Extra meal / catering context beyond the fixed `mealPlan` option. */
  mealNotes?: string;
  supportServices?: string[];
  includedServices?: string[];
  excludedServices?: string[];
  optionalServices?: string[];
  /** Workspace guide language ids (`workspace_guide_languages.id`). */
  guideLanguageIds?: string[];
  /** @deprecated Use `guideLanguageIds`. */
  guideLanguage?: string[];
  groupSizeMin?: number;
  groupSizeMax?: number;
}

export type TripDetailsExperienceLevel = "none" | "basic" | "intermediate" | "advanced";
export type TripDetailsGenderRestriction = "none" | "male_only" | "female_only";

/** Fixed audience segments for suitable / not-suitable matrix (`tripDetails.participation`). */
export const TOUR_AUDIENCE_GROUP_VALUES = [
  "families",
  "solo_travelers",
  "seniors",
  "kids",
  "beginners",
  "experienced_hikers",
] as const;
export type TourAudienceGroup = (typeof TOUR_AUDIENCE_GROUP_VALUES)[number];

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
  /** Workspace equipment item ids (`workspace_equipment_items.id`). */
  gearRequiredIds?: string[];
  /** Workspace equipment item ids (`workspace_equipment_items.id`). */
  gearOptionalIds?: string[];
  documentsRequired?: string[];
  suitableFor?: TourAudienceGroup[];
  notSuitableFor?: TourAudienceGroup[];
  sportsInsuranceRequired?: boolean;
  /** When true, API requires authenticated profile with `national_id` for registration / waitlist. */
  registrationNationalIdRequired?: boolean;
}

/**
 * Documented keys on `tripDetails.overview` (JSONB). Additional keys are allowed.
 */
export interface TourTripDetailsOverviewFields {
  /** Workspace catalog ids (`workspace_tour_themes.id`). */
  tourThemeIds?: string[];
  /**
   * Optional id → label snapshot from last save; used when a theme id no longer exists
   * in the workspace catalog for display on read-only surfaces.
   */
  tourThemeLabels?: Record<string, string>;
}

export interface TourTripDetails {
  schemaVersion?: number;
  overview?: Record<string, unknown> & TourTripDetailsOverviewFields;
  itinerary?: Record<string, unknown>;
  participation?: TourTripDetailsParticipation;
  logistics?: TourTripDetailsLogistics;
  policies?: Record<string, unknown>;
  photos?: Array<{
    id: string;
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  }>;
}

export interface TourDetailsDto {
  destinationName?: string;
  elevationM?: number;
  difficulty?: DifficultyLevel;
  /**
   * Inclusive day count derived server-side from
   * `tripDetails.logistics.departureDate` / `returnDate` (range 1–60). Read-only on the client;
   * editable input has been removed in favor of the date pickers.
   */
  durationDays?: number;
  meetingPoint?: string;
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
  tourType?: TourType | null;
  /** Organized transport for the tour (multi-select). Empty = none / unset. */
  transportModes: ("bus" | "train" | "plane" | "private_car")[];
  /** Resolved form profile at tour creation; optional compliance snapshot. */
  formProfileSnapshot?: TourFormProfile | null;
  /** FK to workspace `workspace_destinations` when linked from Settings → Locations. */
  destinationId?: string | null;
  /** Display name from linked destination (list/detail UI). */
  destinationName?: string | null;
  /** Region name for the linked destination (list/detail UI). */
  destinationRegionName?: string | null;
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
