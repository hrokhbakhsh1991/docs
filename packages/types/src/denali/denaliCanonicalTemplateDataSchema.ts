/**
 * Strict deep-partial Zod schema for workspace template `canonicalData` JSONB.
 * Save-time authority: unknown keys fail loudly; nested slices validate when present.
 */
import { z } from "zod";

import {
  DENALI_CANONICAL_CATEGORY_VALUES,
  DENALI_CANONICAL_DURATION_VALUES,
  DENALI_CANONICAL_TRANSPORT_MODE_VALUES,
} from "./denaliCanonicalTourModel";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isParsableIsoDateTime(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !Number.isNaN(Date.parse(trimmed));
}

const denaliTemplateLocationSchema = z
  .object({
    id: z.string().optional(),
    addressText: z.string().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  })
  .strict();

const denaliTemplateProgramSchema = z
  .object({
    themeIds: z.array(z.string().regex(UUID_V4, "Invalid theme id.")).optional(),
    shortDescription: z.string().trim().optional(),
    longDescription: z.string().trim().optional(),
    difficultyLevel: z.number().min(1).max(10).optional(),
    hikingHoursApprox: z.number().int().min(1).optional(),
    hikingGoHours: z.number().int().min(1).optional(),
    hikingReturnHours: z.number().int().min(1).optional(),
    itinerary: z
      .array(
        z
          .object({
            day: z.number().int().min(1),
            activities: z.string(),
            locationText: z.string().optional(),
            location: denaliTemplateLocationSchema.optional(),
            photos: z
              .array(
                z
                  .object({
                    id: z.string(),
                    url: z.string(),
                    filename: z.string().optional(),
                    size: z.number().optional(),
                    mimeType: z.string().optional(),
                    uploadedAt: z.string().optional(),
                  })
                  .strict(),
              )
              .optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const denaliTemplateTransportSchema = z
  .object({
    mode: z.enum(DENALI_CANONICAL_TRANSPORT_MODE_VALUES).optional(),
    transportCost: z.number().int().min(1).optional(),
    allowPersonalCar: z.boolean().optional(),
    dongAmount: z.number().int().min(1).optional(),
    adminCapacityApproval: z.boolean().optional(),
    transportNotes: z.string().trim().optional(),
    seatPreference: z.enum(["window", "aisle", "any"]).optional(),
  })
  .strict();

const denaliTemplatePricingSchema = z
  .object({
    requiresPayment: z.boolean().optional(),
    basePricePerPerson: z.number().int().min(1).optional(),
    paymentMode: z.enum(["offline_receipt"]).optional(),
    includesTourInsurance: z.boolean().optional(),
  })
  .strict();

const denaliTemplateParticipantsSchema = z
  .object({
    minimumAge: z.number().int().min(0).optional(),
    maximumAge: z.number().int().min(0).optional(),
    fitnessLevel: z.enum(["low", "medium", "high"]).optional(),
    nationalIdRequired: z.boolean().optional(),
    sportsInsuranceRequired: z.boolean().optional(),
    minRequiredPeaks: z.number().int().min(1).max(4).optional(),
    fitnessPrerequisiteText: z.string().trim().optional(),
    gearItems: z
      .array(
        z
          .object({
            id: z.string().regex(UUID_V4),
            isRequired: z.boolean(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const denaliTemplatePoliciesSchema = z
  .object({
    policiesText: z.string().trim().optional(),
    cancellationDeadlineHours: z.number().int().min(1).optional(),
    cancellationPenaltyPercentage: z.number().int().min(0).max(100).optional(),
  })
  .strict();

const denaliTemplatePhotoSchema = z
  .object({
    id: z.string().regex(UUID_V4),
    url: z.string().url(),
    filename: z.string().trim().min(1),
    size: z.number().int().min(0).max(5 * 1024 * 1024),
    mimeType: z.string().regex(/^image\/(jpeg|png|webp)$/),
    uploadedAt: z.string().trim().refine(isParsableIsoDateTime, "Invalid uploadedAt datetime."),
  })
  .strict();

/** Deep-partial canonical tour payload allowed in workspace template JSONB at save time. */
export const denaliCanonicalTemplateDataSchema = z
  .object({
    category: z.enum(DENALI_CANONICAL_CATEGORY_VALUES).optional(),
    duration: z.enum(DENALI_CANONICAL_DURATION_VALUES).optional(),
    title: z.string().trim().optional(),
    destinationId: z.string().regex(UUID_V4).optional(),
    startDateTime: z
      .string()
      .trim()
      .refine(isParsableIsoDateTime, "startDateTime must be a valid ISO datetime.")
      .optional(),
    endDateTime: z
      .string()
      .trim()
      .refine((v) => v === "" || isParsableIsoDateTime(v), "endDateTime must be a valid ISO datetime.")
      .optional(),
    capacityMax: z.number().int().min(1).optional(),
    capacityMin: z.number().int().min(0).optional(),
    meetingPoint: z.string().trim().optional(),
    startPointLocationText: z.string().trim().optional(),
    gatheringPoint: denaliTemplateLocationSchema.optional(),
    gatheringPoints: z
      .array(
        z
          .object({
            id: z.string().optional(),
            title: z.string().optional(),
            time: z.string().optional(),
            location: denaliTemplateLocationSchema,
          })
          .strict(),
      )
      .optional(),
    customServiceLabels: z.array(z.string()).optional(),
    overview: z
      .object({
        nonAttendanceDetails: z.string().trim().optional(),
        peakHeight: z.number().int().min(0).optional(),
      })
      .strict()
      .optional(),
    metrics: z
      .object({
        elevationGain: z.number().int().min(0).optional(),
      })
      .strict()
      .optional(),
    startPoint: denaliTemplateLocationSchema.optional(),
    summitPoint: denaliTemplateLocationSchema.optional(),
    campPoint: denaliTemplateLocationSchema.optional(),
    endPoint: denaliTemplateLocationSchema.optional(),
    approximateReturnTime: z.string().trim().optional(),
    leaderUserIds: z.array(z.string().regex(UUID_V4)).optional(),
    requiresLocalGuide: z.boolean().optional(),
    localGuideName: z.string().trim().optional(),
    requiresManualAdminApproval: z.boolean().optional(),
    publishStatus: z.enum(["draft", "active"]).optional(),
    socialMediaLink: z.string().trim().max(2048).optional(),
    program: denaliTemplateProgramSchema.optional(),
    transport: denaliTemplateTransportSchema.optional(),
    pricing: denaliTemplatePricingSchema.optional(),
    participants: denaliTemplateParticipantsSchema.optional(),
    policies: denaliTemplatePoliciesSchema.optional(),
    photos: z.array(denaliTemplatePhotoSchema).max(10).optional(),
  })
  .strict();

export type DenaliCanonicalTemplateDataSchema = z.infer<typeof denaliCanonicalTemplateDataSchema>;
