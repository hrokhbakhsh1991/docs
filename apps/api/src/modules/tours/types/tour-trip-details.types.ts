import type { DifficultyLevel } from "../entities/tour-details.entity";

/** Document version for forward-compatible reads/writes. */
export type TourTripDetailsSchemaVersion = 1;

export const TRIP_STYLE_VALUES = [
  "mountaineering",
  "nature",
  "cultural",
  "city",
  "desert",
  "adventure",
  "mixed"
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
  tourTheme?: string[];
  tripStyle?: TripStyle;
  difficultyLevel?: DifficultyLevel;
  elevationGainMeters?: number;
  maxAltitudeMeters?: number;
  bestFor?: string[];
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
  gearRequired?: string[];
  gearOptional?: string[];
  documentsRequired?: string[];
  suitableFor?: string[];
  notSuitableFor?: string[];
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
  /** Planned transportation notes (mode/route/operator). */
  transportation?: string;
  /** Accommodation style/type used during the trip. */
  accommodationType?: string;
  /** Meal coverage summary (e.g. breakfast only, full board). */
  mealPlan?: string;
  /** Operational support items as bullet-style strings. */
  supportServices?: string[];
  /** Services included in base price as bullet-style strings. */
  includedServices?: string[];
  /** Services explicitly excluded from base price as bullet-style strings. */
  excludedServices?: string[];
  /** Optional paid add-ons as bullet-style strings. */
  optionalServices?: string[];
  /** Guide language(s) available for this trip. */
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
