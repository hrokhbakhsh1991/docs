import type { AccommodationTypeSlug, MealPlanSlug } from "@repo/types";

import type { DifficultyLevel } from "../entities/tour-details.entity";
import type { DifficultyRating } from "../tour-difficulty-rating";
import type { AudienceGroup } from "../audience-groups";

/** Document version for forward-compatible reads/writes. */
export type TourTripDetailsSchemaVersion = 1;

/**
 * Sub-genre / **execution style** of the trip — orthogonal to top-level `TourType`
 * (the category). Multi-select: a single tour may combine, e.g. `adventure` +
 * `photography`, or `luxury` + `relaxed`.
 *
 * Legacy single-string values (`mountaineering`, `nature`, `cultural`, `city`,
 * `desert`, `mixed`) were category-like and were dropped during the
 * tourType vs. execution-style role split. The previous singular style value `"relax"`
 * has been renamed to `relaxed`. Existing JSONB documents are left untouched;
 * readers should treat unknown values as ignorable, and forms simply omit them
 * from the multi-select.
 */
export const TRIP_STYLE_VALUES = [
  "adventure",
  "relaxed",
  "luxury",
  "budget",
  "familyFriendly",
  "photography"
] as const;
export type TripStyle = (typeof TRIP_STYLE_VALUES)[number];

export const GENDER_RESTRICTION_VALUES = ["none", "male_only", "female_only"] as const;
export type GenderRestriction = (typeof GENDER_RESTRICTION_VALUES)[number];

export const EXPERIENCE_LEVEL_VALUES = ["none", "basic", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVEL_VALUES)[number];

/** Structured day-by-day plan (same shape as legacy `tour_details.itinerary` JSON). */
export interface TripDetailsDayPlan {
  day: number;
  title?: string;
  description?: string;
  distanceKm?: number;
  elevationGainM?: number;
}

export interface TripDetailsOverview {
  mainDestination?: string;
  destinationRegion?: string;
  /** Workspace theme catalog ids (`workspace_tour_themes.id`). */
  tourThemeIds?: string[];
  /** Optional id → display label snapshot when a catalog entry was removed. */
  tourThemeLabels?: Record<string, string>;
  /**
   * Multi-select execution style (orthogonal to top-level `tourType`).
   * Replaces a legacy singular overview style field. Empty/omitted = unspecified.
   */
  tripStyles?: TripStyle[];
  /**
   * Numeric scale `1..10` with `0.5` step (19 allowed values).
   * Replaces the legacy `DifficultyLevel` enum on the overview layer.
   * Top-level `tour_details.difficulty` and `participation.fitnessLevel`
   * keep the legacy enum.
   */
  difficultyLevel?: DifficultyRating;
  elevationGainMeters?: number;
  maxAltitudeMeters?: number;
  /**
   * @deprecated Replaced by the structured `participation.suitableFor` /
   * `participation.notSuitableFor` audience matrix (fixed `AudienceGroup` enum).
   * Field is retained for backward-compatible reads of older JSONB documents only;
   * the create/edit form no longer renders or writes it.
   */
  bestFor?: string[];
  /**
   * Short teaser (≤250 chars) for tour cards / list previews / meta description.
   * If empty, the UI falls back to `Tour.description` (the long-form copy) for cards.
   */
  shortIntro?: string;
}

export interface TripDetailsItinerary {
  highlights?: string[];
  includedVisits?: string[];
  excludedVisits?: string[];
  optionalActivities?: string[];
  /** Free-text itinerary / program summary (avoids naming collision with structured `dayPlans`). */
  outline?: string;
  programNotes?: string;
  specialExperiences?: string[];
  dayPlans?: TripDetailsDayPlan[];
}

export interface TripDetailsParticipation {
  minimumAge?: number;
  maximumAge?: number;
  genderRestriction?: GenderRestriction;
  fitnessLevel?: DifficultyLevel;
  experienceLevel?: ExperienceLevel;
  medicalRestrictions?: string;
  /** Specific technical skill expectation (e.g. rope work, crampon/ice-axe handling). */
  technicalSkillRequired?: string;
  requirements?: string;
  skillsRequired?: string[];
  gearRequiredIds?: string[];
  gearOptionalIds?: string[];
  documentsRequired?: string[];
  /**
   * Audience groups this tour is well-suited for (fixed enum {@link AudienceGroup}).
   * Must NOT overlap with `notSuitableFor` (validated server-side).
   * Legacy free-form values from older JSONB documents are silently dropped during
   * normalization on save.
   */
  suitableFor?: AudienceGroup[];
  /** Audience groups this tour is NOT suitable for. See {@link suitableFor}. */
  notSuitableFor?: AudienceGroup[];
  /** Participant must carry valid sport / mountaineering insurance (leader-enforced). */
  sportsInsuranceRequired?: boolean;
  /**
   * When true, registration is allowed only for authenticated users whose profile includes a national ID.
   * Enforced in {@link RegistrationsService}.
   */
  registrationNationalIdRequired?: boolean;
}

export interface TripDetailsLogistics {
  /** Primary meetup location before departure. */
  meetingPoint?: string;
  /** Local meetup time at the departure point (`HH:mm`). */
  departureMeetingTime?: string;
  /** Calendar departure date (`YYYY-MM-DD`). */
  departureDate?: string;
  /** Calendar return date (`YYYY-MM-DD`). */
  returnDate?: string;
  /** Drop-off / return location after the trip. */
  returnPoint?: string;
  /** Planned transportation notes (mode, route, operator, vehicle). */
  transportationNotes?: string;
  /**
   * @deprecated Legacy JSONB key. Use `transportationNotes`. Kept for reading existing documents;
   * server write path mirrors `transportationNotes` into this field during migration.
   */
  transportation?: string;
  /** Accommodation categories (multi-select). */
  accommodationTypes?: AccommodationTypeSlug[];
  /** Extra accommodation details not covered by `accommodationTypes`. */
  accommodationNotes?: string;
  /**
   * @deprecated Legacy free-text field. Use `accommodationTypes` and optional `accommodationNotes`.
   */
  accommodationType?: string;
  /** Included meals (single choice). */
  mealPlan?: MealPlanSlug;
  /** Extra meal or catering context beyond `mealPlan`. */
  mealNotes?: string;
  /** Operational support items as bullet-style strings. */
  supportServices?: string[];
  /** Services included in base price as bullet-style strings. */
  includedServices?: string[];
  /** Services explicitly excluded from base price as bullet-style strings. */
  excludedServices?: string[];
  /** Optional paid add-ons as bullet-style strings. */
  optionalServices?: string[];
  /** Workspace guide languages offered on this trip (ids from `workspace_guide_languages`). */
  guideLanguageIds?: string[];
  /**
   * @deprecated Free-text language tags. Use `guideLanguageIds` and the workspace guide language catalogue.
   */
  guideLanguage?: string[];
  /** Minimum participants required for the tour to run. */
  groupSizeMin?: number;
  /** Maximum participants allowed for the tour. */
  groupSizeMax?: number;
}

export interface TripDetailsPolicies {
  reservationRules?: string;
  cancellationPolicy?: string;
  refundPolicy?: string;
  attendanceRules?: string;
  lateArrivalPolicy?: string;
  noShowPolicy?: string;
  confirmationPolicy?: string;
  capacityPolicy?: string;
  weatherPolicy?: string;
  safetyPolicy?: string;
}

/**
 * Structured marketing / operational detail blob (JSONB).
 * `tours.description` remains separate free-form copy.
 */
export interface TourTripDetails {
  schemaVersion?: TourTripDetailsSchemaVersion;
  overview?: TripDetailsOverview;
  itinerary?: TripDetailsItinerary;
  participation?: TripDetailsParticipation;
  logistics?: TripDetailsLogistics;
  policies?: TripDetailsPolicies;
}
