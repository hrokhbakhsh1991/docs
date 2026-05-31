import { z } from "zod";

import { TOUR_TYPES } from "@repo/types";

import { costContextWireSchema } from "./cost-context-wire.schema";
import { CREATE_TOUR_POST_WIRE_KEYS, type CreateTourPostWireKey } from "./create-tour-wire-keys";
import { tourItineraryItemWireSchema } from "./tour-itinerary-wire.schema";
import { tourMetadataWireSchema } from "./tour-metadata-wire.schema";
import { tourTripDetailsWireSchema } from "./tour-trip-details-wire.schema";
import {
  DIFFICULTY_LEVEL_WIRE_VALUES,
  TOUR_CREATE_LIFECYCLE_WIRE_VALUES,
  TOUR_DURATION_DAYS_WIRE_MAX,
  TOUR_DURATION_DAYS_WIRE_MIN,
  TOUR_TITLE_WIRE_MAX_LENGTH,
  TOUR_TITLE_WIRE_MIN_LENGTH,
  TOUR_TRANSPORT_MODE_WIRE_VALUES,
} from "./wire-constants";
import { optionalTrimmedString } from "./wire-primitives";

const tourCreatePostFieldSchemas = {
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
  lifecycle_status: z.enum(TOUR_CREATE_LIFECYCLE_WIRE_VALUES),
  meetingPoint: optionalTrimmedString(2048),
  metadata: tourMetadataWireSchema.optional(),
  sourcePresetId: z.string().uuid().optional(),
  sourceTourId: z.string().uuid().optional(),
  stagingTourId: z.string().uuid().optional(),
  title: z
    .string()
    .trim()
    .min(TOUR_TITLE_WIRE_MIN_LENGTH)
    .max(TOUR_TITLE_WIRE_MAX_LENGTH),
  total_capacity: z.number().int().min(0),
  tourType: z.enum(TOUR_TYPES as unknown as [string, ...string[]]).optional(),
  transportModes: z.array(z.enum(TOUR_TRANSPORT_MODE_WIRE_VALUES)).optional(),
  tripDetails: tourTripDetailsWireSchema.optional(),
} satisfies Record<CreateTourPostWireKey, z.ZodTypeAny>;

/** Client POST `/api/v2/tours` wire shape (excludes ignored server hints such as `formProfile`). */
export type TourCreatePostContract = z.infer<typeof tourCreatePostContractSchema>;

export const tourCreatePostContractSchema = z.object(tourCreatePostFieldSchemas).strict();

/** @deprecated Use {@link tourCreatePostContractSchema} — alias kept for existing imports. */
export const tourCreateContractSchema = tourCreatePostContractSchema;

export const TOUR_CREATE_POST_CONTRACT_FIELDS = CREATE_TOUR_POST_WIRE_KEYS;

/** @deprecated Use {@link TOUR_CREATE_POST_CONTRACT_FIELDS}. */
export const TOUR_CREATE_CONTRACT_FIELDS = CREATE_TOUR_POST_WIRE_KEYS;

export type TourCreateContract = TourCreatePostContract;

/**
 * Validates a POST body against the shared wire contract.
 * Throws {@link z.ZodError} when structural parity fails.
 */
export function parseCreateTourPostWireBody(body: unknown): TourCreatePostContract {
  return tourCreatePostContractSchema.parse(body);
}

export function safeParseCreateTourPostWireBody(body: unknown) {
  return tourCreatePostContractSchema.safeParse(body);
}
