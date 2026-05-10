import { z } from "zod";

import { TOUR_TYPES } from "@repo/types";

import { getTripDetailsFieldConfigForKind } from "@/features/tours/config/tripDetailsFieldConfig";
import {
  applyTripDetailsRequirednessToSchema,
  TourTripDetailsRootSchema,
} from "@/features/tours/models/tourTripDetails.schema";
import { tourLocationSectionSchema } from "@/features/tours/models/tourCreateModel";
import type { EventKind } from "@/features/tours/policies/tour-kind-policy";

/**
 * Form values aligned with `TourDto` and UI lifecycle mapping (`draft` → DRAFT …).
 * Tour schedule dates are out of MVP scope and are not sent to the API.
 */
const TourBaseSchema = z.object({
    title: z.string().trim().min(2, "Title must be at least 2 characters."),
    description: z.string().default(""),
    totalCapacity: z.number().int().positive("Capacity must be a positive integer."),
    price: z.number().min(0, "Price must be 0 or greater."),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    communicationLink: z
      .string()
      .trim()
      .max(2048, "Link is too long.")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    tourType: z.enum(TOUR_TYPES).optional(),
    destinationId: z.preprocess(
      (raw) => (raw === "" || raw === undefined ? null : raw),
      z.union([z.string().uuid(), z.null()]),
    ),
    locationSection: tourLocationSectionSchema,
    /** Same nested shape as create-tour (`POST /api/v2/tours`); PATCH uses `compactTripDetailsForApi` before send. */
    tripDetails: TourTripDetailsRootSchema,
  });

export function createTourSchemaForEventKind(eventKind: EventKind) {
  return TourBaseSchema.extend({
    tripDetails: applyTripDetailsRequirednessToSchema(getTripDetailsFieldConfigForKind(eventKind)),
  });
}

export const TourSchema = createTourSchemaForEventKind("generic");

export type TourFormInput = z.input<typeof TourSchema>;
export type TourFormValues = z.output<typeof TourSchema>;
