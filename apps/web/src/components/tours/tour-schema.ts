import { z } from "zod";

import {
  gatheringPickupStationIsConcrete,
  normalizeGatheringPickupStations,
  TOUR_TYPES,
  type TourFormProfile,
} from "@repo/types";

const DENALI_PUBLISH_GEO_ZONE_KEYS = ["startPoint"] as const;

function denaliPublishGeoIsConcrete(loc: unknown): boolean {
  if (loc == null || typeof loc !== "object" || Array.isArray(loc)) {
    return false;
  }
  const row = loc as Record<string, unknown>;
  const addressText = typeof row.addressText === "string" ? row.addressText.trim() : "";
  if (addressText === "") {
    return false;
  }
  const lat = row.latitude;
  const lng = row.longitude;
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  );
}

import { getTripDetailsFieldConfigForProfile } from "@/features/tours/config/tripDetailsFieldConfigAdapter";
import {
  applyTripDetailsRequirednessToSchema,
  TourTripDetailsRootSchema,
} from "@/features/tours/models/tourTripDetails.schema";
import { tourLocationSectionSchema } from "@/features/tours/models/tourCreateModel";

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

export function createTourSchemaForProfile(profile: TourFormProfile) {
  const schema = TourBaseSchema.extend({
    tripDetails: applyTripDetailsRequirednessToSchema(getTripDetailsFieldConfigForProfile(profile)),
  });

  if (profile !== "denali_pilot") {
    return schema;
  }

  return schema.superRefine((data, ctx) => {
    if (data.status !== "active") {
      return;
    }
    const overview = data.tripDetails?.overview as Record<string, unknown> | undefined;
    const logistics = data.tripDetails?.logistics as Record<string, unknown> | undefined;

    const gatheringPoints = normalizeGatheringPickupStations(logistics?.gatheringPoints);
    if (gatheringPoints.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tripDetails", "logistics", "gatheringPoints"],
        message: "برای انتشار تور، حداقل یک ایستگاه تجمع الزامی است.",
      });
    } else {
      gatheringPoints.forEach((station, index) => {
        if (!gatheringPickupStationIsConcrete(station)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tripDetails", "logistics", "gatheringPoints", index],
            message: "هر ایستگاه تجمع باید عنوان، آدرس و مختصات معتبر داشته باشد.",
          });
        }
      });
    }

    for (const zoneKey of DENALI_PUBLISH_GEO_ZONE_KEYS) {
      if (!denaliPublishGeoIsConcrete(overview?.[zoneKey])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tripDetails", "overview", zoneKey, "addressText"],
          message:
            "برای انتشار تور، آدرس و مختصات دقیق این نقطه (عرض و طول جغرافیایی) الزامی است.",
        });
      }
    }
  });
}

export const TourSchema = createTourSchemaForProfile("general");

export type TourFormInput = z.input<typeof TourSchema>;
export type TourFormValues = z.output<typeof TourSchema>;
