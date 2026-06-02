/** Top-level tour transport modes (`CreateTourDto.transportModes`). */
export const TOUR_TRANSPORT_MODE_WIRE_VALUES = [
  "bus",
  "train",
  "plane",
  "private_car",
] as const;

/** Execution styles (`tripDetails.overview.tripStyles`). */
export const TRIP_STYLE_WIRE_VALUES = [
  "adventure",
  "relaxed",
  "luxury",
  "budget",
  "familyFriendly",
  "photography",
] as const;

export const DIFFICULTY_LEVEL_WIRE_VALUES = ["easy", "moderate", "hard", "technical"] as const;

export const GENDER_RESTRICTION_WIRE_VALUES = ["none", "male_only", "female_only"] as const;

export const EXPERIENCE_LEVEL_WIRE_VALUES = ["none", "basic", "intermediate", "advanced"] as const;

export const PRIMARY_LOGISTICS_TRANSPORT_MODE_WIRE_VALUES = [
  "plane",
  "train",
  "bus",
  "midibus",
  "private_car",
] as const;

export const TOUR_PAYMENT_MODE_WIRE_VALUES = ["offline_receipt"] as const;

export const TOUR_CREATE_LIFECYCLE_WIRE_VALUES = ["Draft", "Open"] as const;

export const TOUR_DURATION_DAYS_WIRE_MIN = 1;
export const TOUR_DURATION_DAYS_WIRE_MAX = 60;

export const TRIP_SHORT_INTRO_WIRE_MAX_LENGTH = 250;

export const TOUR_TITLE_WIRE_MIN_LENGTH = 10;
export const TOUR_TITLE_WIRE_MAX_LENGTH = 120;
