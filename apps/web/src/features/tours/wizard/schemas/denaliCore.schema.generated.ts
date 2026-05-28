// DEPRECATED: DO NOT EDIT. AUTO-GENERATED.
/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: denaliFieldRegistryData.ts (+ denaliRuleMatrixRecipes.ts)
 * Run: pnpm --filter web generate:denali-wizard
 */

import { z } from "zod";

import { TOUR_TITLE_MAX_LENGTH, TOUR_TITLE_MIN_LENGTH } from "@/features/tours/models/tours-new-validation-messages";

import {
  denaliImageFileAssetSchema,
  DENALI_MAX_PHOTO_COUNT,
} from "./denaliFileAssetSchema";
import {
  denaliItineraryDayRowSchema,
  optionalApproximateReturnTimeSchema,
} from "./denaliItineraryDaySchema";
import { denaliLocationDataSchema } from "./denaliLocationDataSchema";
import {
  denaliTourKindSchema,
  isParsableIsoDateTime,
  optionalInt,
  optionalPositiveInt,
  rejectZeroAmount,
} from "./denaliSchemaPrimitives";


export const denaliBasicInfoSchema = z.object({
  approximateReturnTime: optionalApproximateReturnTimeSchema(),
  campPoint: denaliLocationDataSchema.optional(),
  capacityMax: z.number().int().optional(),
  capacityMin: optionalInt("مقدار نمی‌تواند منفی باشد."),
  destinationId: z.string().trim().optional(),
  endDateTime: z
    .string()
    .trim()
    .optional()
    .refine((v) => v == null || v === "" || isParsableIsoDateTime(v), {
      message: "زمان پایان باید به‌صورت ISO datetime معتبر باشد.",
    })
    .transform((v) => (v == null || v === "" ? undefined : v)),
  endPoint: denaliLocationDataSchema.optional(),
  gatheringPoint: denaliLocationDataSchema.optional(),
  leaderUserIds: z.array(z.string().trim()).default([]),
  localGuideName: z.string().trim().optional(),
  meetingPoint: z.string().trim().optional(),
  publishStatus: z.enum(["draft", "active"]).optional(),
  requiresLocalGuide: z.boolean().optional(),
  requiresManualAdminApproval: z.boolean().optional(),
  socialMediaLink: z.string().trim().max(2048).optional(),
  startDateTime: z
    .string()
    .trim()
    .refine(isParsableIsoDateTime, "زمان شروع باید به‌صورت ISO datetime معتبر باشد."),
  startPoint: denaliLocationDataSchema.optional(),
  startPointLocationText: z.string().trim().optional(),
  summitPoint: denaliLocationDataSchema.optional(),
  title: z
    .string()
    .trim()
    .max(TOUR_TITLE_MAX_LENGTH, `عنوان نباید بیشتر از ${TOUR_TITLE_MAX_LENGTH} نویسه باشد.`)
    .refine(
      (v) => v.length === 0 || v.length >= TOUR_TITLE_MIN_LENGTH,
      `عنوان باید حداقل ${TOUR_TITLE_MIN_LENGTH} نویسه باشد.`,
    ),
  tourType: denaliTourKindSchema,
});

export const denaliProgramNatureSchema = z.object({
  difficultyLevel: z.number().min(1).max(10).optional(),
  hikingGoHours: optionalPositiveInt(1),
  hikingHoursApprox: optionalPositiveInt(1),
  hikingReturnHours: optionalPositiveInt(1),
  itinerary: z.array(denaliItineraryDayRowSchema).optional(),
  longDescription: z.string().trim().optional(),
  shortDescription: z.string().trim().optional(),
  themeIds: z.array(z.string().trim()).default([]),
});

export const denaliPhotosSchema = z.object({
  photos: z
    .array(denaliImageFileAssetSchema)
    .max(DENALI_MAX_PHOTO_COUNT, "حداکثر ۱۰ عکس مجاز است.")
    .optional(),
});

export const denaliTripDetailsMetricsSchema = z.object({
  elevationGain: optionalInt("مقدار نمی‌تواند منفی باشد."),
});

export const denaliTripDetailsOverviewCoreSchema = z.object({
  peakHeight: optionalInt("مقدار نمی‌تواند منفی باشد."),
});

export function applyDenaliCoreSchemaRefinements(
  data: {
    basicInfo: z.infer<typeof denaliBasicInfoSchema>;
  },
  ctx: z.RefinementCtx,
): void {
  rejectZeroAmount(
    data.basicInfo.capacityMax,
    ctx,
    ["basicInfo", "capacityMax"],
    "حداکثر ظرفیت باید حداقل ۱ باشد.",
  );
}
