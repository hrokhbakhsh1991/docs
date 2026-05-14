/**
 * Top-level JSON keys accepted by Nest `CreateTourDto` (`apps/api/src/modules/tours/dto/create-tour.dto.ts`).
 * Sorted alphabetically; update when the DTO gains or loses a root field.
 */
export const CREATE_TOUR_DTO_WIRE_KEYS = [
  "autoAcceptRegistrations",
  "chat_link",
  "cost_context",
  "description",
  "destinationId",
  "destinationName",
  "difficulty",
  "durationDays",
  "elevationM",
  "formProfile",
  "itinerary",
  "lifecycle_status",
  "meetingPoint",
  "title",
  "total_capacity",
  "tourType",
  "transportModes",
  "tripDetails"
] as const;

export type CreateTourDtoWireKey = (typeof CREATE_TOUR_DTO_WIRE_KEYS)[number];
