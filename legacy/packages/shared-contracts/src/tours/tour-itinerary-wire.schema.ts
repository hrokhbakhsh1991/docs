import { z } from "zod";

import { optionalTrimmedString } from "./wire-primitives";

/** Root-level `CreateTourDto.itinerary` row (legacy flat day list). */
export const tourItineraryItemWireSchema = z
  .object({
    day: z.number().int().min(1),
    title: optionalTrimmedString(500),
    description: optionalTrimmedString(10_000),
    distanceKm: z.number().int().min(0).max(50_000).optional(),
    elevationGainM: z.number().int().min(-10_000).max(30_000).optional(),
  })
  .strict();

export type TourItineraryItemWire = z.infer<typeof tourItineraryItemWireSchema>;
