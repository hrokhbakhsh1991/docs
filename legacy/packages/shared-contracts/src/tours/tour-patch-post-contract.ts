import { TOUR_TYPES } from "@repo/types";
import { z } from "zod";

import { costContextWireSchema } from "./cost-context-wire.schema";
import { tourItineraryItemWireSchema } from "./tour-itinerary-wire.schema";
import { tourMetadataWireSchema } from "./tour-metadata-wire.schema";
import { tourTripDetailsWireSchema } from "./tour-trip-details-wire.schema";
import {
  DIFFICULTY_LEVEL_WIRE_VALUES,
  TOUR_DURATION_DAYS_WIRE_MAX,
  TOUR_DURATION_DAYS_WIRE_MIN,
  TOUR_TITLE_WIRE_MAX_LENGTH,
  TOUR_TITLE_WIRE_MIN_LENGTH,
  TOUR_TRANSPORT_MODE_WIRE_VALUES,
} from "./wire-constants";
import { optionalTrimmedString } from "./wire-primitives";

export const TOUR_PATCH_LIFECYCLE_WIRE_VALUES = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "CANCELLED",
] as const;

/** Keys accepted on `PATCH /api/v2/tours/:id` (excludes create-only staging/source hints). */
export const TOUR_PATCH_POST_WIRE_KEYS = [
  "autoAcceptRegistrations",
  "chat_link",
  "cost_context",
  "customServiceLabels",
  "description",
  "destinationId",
  "destinationName",
  "difficulty",
  "durationDays",
  "elevationM",
  "itinerary",
  "lifecycle_status",
  "meetingPoint",
  "metadata",
  "title",
  "total_capacity",
  "tourType",
  "transportModes",
  "tripDetails",
] as const;

export type TourPatchPostWireKey = (typeof TOUR_PATCH_POST_WIRE_KEYS)[number];

const tourPatchPostFieldSchemas = {
  autoAcceptRegistrations: z.boolean().optional(),
  chat_link: optionalTrimmedString(2048),
  cost_context: costContextWireSchema.optional(),
  customServiceLabels: z.array(z.string().trim().min(1)).optional(),
  description: optionalTrimmedString(50_000),
  destinationId: z.union([z.string().uuid(), z.null()]).optional(),
  destinationName: optionalTrimmedString(500),
  difficulty: z.enum(DIFFICULTY_LEVEL_WIRE_VALUES).optional(),
  elevationM: z.number().int().optional(),
  durationDays: z
    .number()
    .int()
    .min(TOUR_DURATION_DAYS_WIRE_MIN)
    .max(TOUR_DURATION_DAYS_WIRE_MAX)
    .optional(),
  itinerary: z.array(tourItineraryItemWireSchema).optional(),
  lifecycle_status: z.enum(TOUR_PATCH_LIFECYCLE_WIRE_VALUES).optional(),
  meetingPoint: optionalTrimmedString(2048),
  metadata: tourMetadataWireSchema.optional(),
  title: z
    .string()
    .trim()
    .min(TOUR_TITLE_WIRE_MIN_LENGTH)
    .max(TOUR_TITLE_WIRE_MAX_LENGTH)
    .optional(),
  total_capacity: z.number().int().min(0).optional(),
  tourType: z.enum(TOUR_TYPES as unknown as [string, ...string[]]).optional(),
  transportModes: z.array(z.enum(TOUR_TRANSPORT_MODE_WIRE_VALUES)).optional(),
  tripDetails: z.union([tourTripDetailsWireSchema, z.null()]).optional(),
} satisfies Record<TourPatchPostWireKey, z.ZodTypeAny>;

export type TourPatchPostContract = z.infer<typeof tourPatchPostContractSchema>;

export const tourPatchPostContractSchema = z.object(tourPatchPostFieldSchemas).strict();

export function parseUpdateTourPatchWireBody(body: unknown): TourPatchPostContract {
  return tourPatchPostContractSchema.parse(body);
}

export function safeParseUpdateTourPatchWireBody(body: unknown) {
  return tourPatchPostContractSchema.safeParse(body);
}
