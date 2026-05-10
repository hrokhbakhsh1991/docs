import { z } from "zod";

import { TOUR_TYPES, type TourType } from "@repo/types";

import { normalizeNumericInput } from "@/lib/digit-localization";
import { applyTripDetailsRequirednessToSchema, TourTripDetailsRootSchema, type TourTripDetails } from "./tourTripDetails.schema";
import {
  DEFAULT_TOURS_NEW_VALIDATION_MESSAGES,
  TOUR_TITLE_MAX_LENGTH,
  TOUR_TITLE_MIN_LENGTH,
  type ToursNewValidationMessages,
} from "./tours-new-validation-messages";
import type { EventKind } from "../policies/tour-kind-policy";
import { getTripDetailsFieldConfigForKind } from "../config/tripDetailsFieldConfig";

export type { ToursNewValidationMessages } from "./tours-new-validation-messages";

/** Picked from Settings → Locations; persisted under `tripDetails.overview` + `cost_context.location` (override). */
export interface TourLocationSectionModel {
  regionId?: string;
  mainDestinationId?: string;
  secondaryDestinationIdsRaw?: string;
  displayLocationOverride?: string;
}

export const tourLocationSectionSchema = z.object({
  regionId: z.string().trim().optional().default(""),
  mainDestinationId: z.string().trim().optional().default(""),
  secondaryDestinationIdsRaw: z.string().trim().optional(),
  displayLocationOverride: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

/**
 * MVP payload aligned with `CreateTourDto` (`apps/web/lib/services/tours.service.ts`).
 * Dates are not sent on create in the current API contract.
 */
export interface TourCreateModel {
  title: string;
  /** Long marketing copy for the tour **detail page**; optional in the API but expected when the tour is public (Open). */
  description?: string;
  socialLinks?: SocialLink[];
  autoAcceptRegistrations: boolean;
  tourType?: TourType;
  /** Organized transport (multi-select). Empty = none / not specified. */
  transportModes: TourTransportMode[];
  /** Telegram / communication URL; sent as `chat_link` on create. */
  communicationLink?: string;
  /** Workspace destination FK (`tours.destination_id`); `null` when unset. */
  destinationId: string | null;
  /** Regions / destinations + display override; meeting/return live under `tripDetails.logistics`. */
  locationSection: TourLocationSectionModel;
  /**
   * Structured trip details → Nest `CreateTourDto.tripDetails` → `tour_details.trip_details` (JSONB).
   * `tripDetails.overview.shortIntro` is a short teaser for cards/previews; root `description` is the long copy for the full tour page.
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

/**
 * Top-level **category** of the tour (`TOUR_TYPES` / `TourType` from `@repo/types`).
 * Sub-genre / execution style lives under `tripDetails.overview.tripStyles`.
 */
export { TOUR_TYPES, type TourType };

export const TOUR_TRANSPORT_MODES = ["bus", "train", "plane", "private_car"] as const;
export type TourTransportMode = (typeof TOUR_TRANSPORT_MODES)[number];

/** Normalize Persian/Arabic-Indic digits to ASCII before Zod coercion. */
function englishDigitsString(raw: unknown): unknown {
  if (typeof raw === "string") {
    return normalizeNumericInput(raw.replace(/\u066b/g, "."));
  }
  return raw;
}

/** Cleared `<input type="number">` yields `""`; coercing via `Number("")` would be `0`, so force NaN instead. */
function emptyNumberInputToNaN(raw: unknown): unknown {
  if (raw === "" || raw === null || raw === undefined) {
    return Number.NaN;
  }
  return raw;
}

function buildTourCreateBaseSchema(msgs: ToursNewValidationMessages) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, msgs.titleRequired)
      .min(TOUR_TITLE_MIN_LENGTH, msgs.titleTooShort)
      .max(TOUR_TITLE_MAX_LENGTH, msgs.titleTooLong),
    description: z.string().trim().optional(),
    destinationId: z.preprocess(
      (raw) => (raw === "" || raw === undefined ? null : raw),
      z.union([z.string().uuid(), z.null()]),
    ),
    locationSection: tourLocationSectionSchema,
    socialLinks: z
      .array(
        z.object({
          platform: z.enum(SOCIAL_PLATFORMS),
          /** Empty string = no link; `.url()` applies only when non-empty after trim. */
          url: z
            .string()
            .trim()
            .max(2048, msgs.linkTooLong)
            .pipe(z.union([z.literal(""), z.string().url(msgs.enterValidUrl)])),
        }),
      )
      .optional(),
    autoAcceptRegistrations: z.boolean().default(true),
    tourType: z.enum(TOUR_TYPES).optional(),
    transportModes: z.array(z.enum(TOUR_TRANSPORT_MODES)).default([]),
    communicationLink: z
      .string()
      .trim()
      .max(2048, msgs.linkTooLong)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    tripDetails: TourTripDetailsRootSchema,
    capacity: z.preprocess(
      (raw) => emptyNumberInputToNaN(englishDigitsString(raw)),
      z.coerce
        .number()
        .refine((n) => Number.isFinite(n), { message: msgs.capacityInvalid })
        .int(msgs.capacityWholeNumber)
        .positive(msgs.capacityMinOne),
    ),
    price: z.preprocess(
      (raw) => emptyNumberInputToNaN(englishDigitsString(raw)),
      z.coerce
        .number()
        .refine((n) => Number.isFinite(n), { message: msgs.priceInvalid })
        .min(0, msgs.priceMinZero),
    ),
    lifecycle_status: z.enum(["Draft", "Open"]),
  });
}

export function createTourCreateSchemaForEventKind(
  eventKind: EventKind,
  messages: ToursNewValidationMessages = DEFAULT_TOURS_NEW_VALIDATION_MESSAGES,
) {
  return buildTourCreateBaseSchema(messages).extend({
    tripDetails: applyTripDetailsRequirednessToSchema(getTripDetailsFieldConfigForKind(eventKind), messages),
  }) satisfies z.ZodType<TourCreateModel>;
}

export const TourCreateSchema = createTourCreateSchemaForEventKind("generic");

export type TourCreateFormInput = z.input<typeof TourCreateSchema>;

export type { TourTripDetails } from "./tourTripDetails.schema";
