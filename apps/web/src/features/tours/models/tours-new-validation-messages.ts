/**
 * Zod validation copy for create-tour (and shared trip-details forms).
 * Defaults preserve the historical English strings used before i18n.
 */
/** Title length contract (min/max are kept in sync with backend `CreateTourDto`). */
export const TOUR_TITLE_MIN_LENGTH = 10;
export const TOUR_TITLE_MAX_LENGTH = 120;

export type ToursNewValidationMessages = {
  titleRequired: string;
  titleTooShort: string;
  titleTooLong: string;
  linkTooLong: string;
  enterValidUrl: string;
  meetingPointTooLong: string;
  capacityInvalid: string;
  capacityWholeNumber: string;
  capacityMinOne: string;
  priceInvalid: string;
  priceMinZero: string;
  intBetween: (min: number, max: number) => string;
  dayMinOne: string;
  difficultyRequiredMountain: string;
  difficultyRatingOutOfRange: string;
  difficultyRatingHalfStep: string;
  minimumAgeRequiredMountain: string;
  gearRequiredMountain: string;
  gearIdEachInvalid: string;
  tourThemeIdEachInvalid: string;
  meetingPointRequiredMountain: string;
  departureDateRequiredMountain: string;
  departureDateNotPast: string;
  returnDateNotPast: string;
  returnDateBeforeDeparture: string;
  timeFormatInvalid: string;
  audienceOverlap: string;
};

export const DEFAULT_TOURS_NEW_VALIDATION_MESSAGES: ToursNewValidationMessages = {
  titleRequired: "Title is required.",
  titleTooShort: `Title must be at least ${TOUR_TITLE_MIN_LENGTH} characters and clearly state the destination/type.`,
  titleTooLong: `Title must be ${TOUR_TITLE_MAX_LENGTH} characters or fewer.`,
  linkTooLong: "Link is too long.",
  enterValidUrl: "Enter a valid URL.",
  meetingPointTooLong: "Meeting point is too long.",
  capacityInvalid: "Enter a valid capacity.",
  capacityWholeNumber: "Capacity must be a whole number.",
  capacityMinOne: "Capacity must be at least 1.",
  priceInvalid: "Enter a valid price.",
  priceMinZero: "Price must be 0 or greater.",
  intBetween: (min, max) => `Must be between ${min} and ${max}.`,
  dayMinOne: "Day must be at least 1.",
  difficultyRequiredMountain: "Difficulty level is required for this event kind.",
  difficultyRatingOutOfRange: "Difficulty must be between 1 and 10.",
  difficultyRatingHalfStep: "Difficulty must be a half-step value (e.g. 1, 1.5, 2 … 10).",
  minimumAgeRequiredMountain: "Minimum age is required for this event kind.",
  gearRequiredMountain: "At least one required equipment item is needed for this event kind.",
  gearIdEachInvalid: "Each value must be a valid equipment id (UUID).",
  tourThemeIdEachInvalid: "Each selected theme must be a valid id (UUID).",
  meetingPointRequiredMountain: "Meeting point is required for this event kind.",
  departureDateRequiredMountain: "Departure date is required for this event kind.",
  departureDateNotPast: "Departure date cannot be in the past.",
  returnDateNotPast: "Return date cannot be in the past.",
  returnDateBeforeDeparture: "Return date must be on or after the departure date.",
  timeFormatInvalid: "Time must be in HH:MM (24h) format.",
  audienceOverlap: "A group cannot be marked as both suitable and not suitable.",
};
