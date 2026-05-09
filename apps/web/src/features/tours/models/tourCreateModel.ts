import { z } from "zod";

import {
  applyTripDetailsRequirednessToSchema,
  TourTripDetailsRootSchema,
  type TourTripDetails,
} from "./tourTripDetails.schema";
import type { EventKind } from "../policies/tour-kind-policy";
import { getTripDetailsFieldConfigForKind } from "../config/tripDetailsFieldConfig";

/**
 * MVP payload aligned with `CreateTourDto` (`apps/web/lib/services/tours.service.ts`).
 * Dates are not sent on create in the current API contract.
 */
export interface TourCreateModel {
  title: string;
  description?: string;
  location?: string;
  socialLinks?: SocialLink[];
  autoAcceptRegistrations: boolean;
  tourType?: TourType;
  primaryTransportMode?: PrimaryTransportMode;
  /** Telegram / communication URL; sent as `chat_link` on create. */
  communicationLink?: string;
  /** Optional; maps to Nest `CreateTourDto.durationDays` → `tour_details.duration_days`. */
  durationDays?: number;
  /** Optional; maps to Nest `CreateTourDto.meetingPoint` → `tour_details.meeting_point`. */
  meetingPoint?: string;
  /**
   * Structured trip details → Nest `CreateTourDto.tripDetails` → `tour_details.trip_details` (JSONB).
   * Separate from `description` (marketing copy).
   */
  tripDetails?: TourTripDetails;
  capacity: number;
  price: number;
  lifecycle_status: "Draft" | "Open";
}

export const SOCIAL_PLATFORMS = ["telegram", "whatsapp", "instagram", "website", "other"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export const TOUR_TYPES = ["camp", "mountain", "city", "desert", "other"] as const;
export type TourType = (typeof TOUR_TYPES)[number];

export const PRIMARY_TRANSPORT_MODES = ["bus", "train", "plane", "private_car", "mixed", "none"] as const;
export type PrimaryTransportMode = (typeof PRIMARY_TRANSPORT_MODES)[number];

/** Cleared `<input type="number">` yields `""`; coercing via `Number("")` would be `0`, so force NaN instead. */
function emptyNumberInputToNaN(raw: unknown): unknown {
  if (raw === "" || raw === null || raw === undefined) {
    return Number.NaN;
  }
  return raw;
}

/** Cleared optional number field → skip (omit from output). */
function optionalNumberInputToUndefined(raw: unknown): unknown {
  if (raw === "" || raw === null || raw === undefined) {
    return undefined;
  }
  return raw;
}

const TourCreateBaseSchema = z.object({
    title: z.string().trim().min(1, "Title is required."),
    description: z.string().trim().optional(),
    location: z.string().trim().optional(),
    socialLinks: z
      .array(
        z.object({
          platform: z.enum(SOCIAL_PLATFORMS),
          /** Empty string = no link; `.url()` applies only when non-empty after trim. */
          url: z
            .string()
            .trim()
            .max(2048, "Link is too long.")
            .pipe(z.union([z.literal(""), z.string().url("Enter a valid URL.")])),
        }),
      )
      .optional(),
    autoAcceptRegistrations: z.boolean().default(true),
    tourType: z.enum(TOUR_TYPES).optional(),
    primaryTransportMode: z.enum(PRIMARY_TRANSPORT_MODES).optional(),
    communicationLink: z
      .string()
      .trim()
      .max(2048, "Link is too long.")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    durationDays: z.preprocess(
      optionalNumberInputToUndefined,
      z.union([
        z.undefined(),
        z.coerce
          .number()
          .int("Duration must be a whole number of days.")
          .positive("Duration must be at least 1 day when set."),
      ]),
    ),
    meetingPoint: z
      .string()
      .trim()
      .max(2048, "Meeting point is too long.")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    tripDetails: TourTripDetailsRootSchema,
    capacity: z.preprocess(
      emptyNumberInputToNaN,
      z.coerce
        .number()
        .refine((n) => Number.isFinite(n), { message: "Enter a valid capacity." })
        .int("Capacity must be a whole number.")
        .positive("Capacity must be at least 1."),
    ),
    price: z.preprocess(
      emptyNumberInputToNaN,
      z.coerce
        .number()
        .refine((n) => Number.isFinite(n), { message: "Enter a valid price." })
        .min(0, "Price must be 0 or greater."),
    ),
    lifecycle_status: z.enum(["Draft", "Open"]),
  });

export function createTourCreateSchemaForEventKind(eventKind: EventKind) {
  return TourCreateBaseSchema.extend({
    tripDetails: applyTripDetailsRequirednessToSchema(
      TourTripDetailsRootSchema,
      getTripDetailsFieldConfigForKind(eventKind),
    ),
  }) satisfies z.ZodType<TourCreateModel>;
}

export const TourCreateSchema = createTourCreateSchemaForEventKind("generic");

export type TourCreateFormInput = z.input<typeof TourCreateSchema>;

export type { TourTripDetails } from "./tourTripDetails.schema";
