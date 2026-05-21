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
  "sourcePresetId",
  "sourceTourId",
  "title",
  "total_capacity",
  "tourType",
  "transportModes",
  "tripDetails"
] as const;

export type CreateTourDtoWireKey = (typeof CREATE_TOUR_DTO_WIRE_KEYS)[number];

/**
 * Keys the web client may send on `POST /api/v2/tours`.
 * `formProfile` is on the Nest DTO for backward compatibility but is ignored server-side
 * (profile resolves from `workspace_tour_wizard_templates.base_profile`).
 */
export const CREATE_TOUR_POST_WIRE_KEYS = [
  "autoAcceptRegistrations",
  "chat_link",
  "cost_context",
  "description",
  "destinationId",
  "destinationName",
  "difficulty",
  "durationDays",
  "elevationM",
  "itinerary",
  "lifecycle_status",
  "meetingPoint",
  "sourcePresetId",
  "sourceTourId",
  "title",
  "total_capacity",
  "tourType",
  "transportModes",
  "tripDetails"
] as const;

export type CreateTourPostWireKey = (typeof CREATE_TOUR_POST_WIRE_KEYS)[number];
