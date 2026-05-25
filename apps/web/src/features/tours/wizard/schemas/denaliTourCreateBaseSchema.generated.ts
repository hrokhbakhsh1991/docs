// DEPRECATED: DO NOT EDIT. AUTO-GENERATED.
/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: denaliFieldRegistryData.ts (+ denaliRuleMatrixRecipes.ts)
 * Run: pnpm --filter web generate:denali-wizard
 */

import { z } from "zod";

import { DENALI_TOUR_KIND_VALUES, type DenaliTourKind } from "@repo/types";

import { TOUR_TITLE_MAX_LENGTH, TOUR_TITLE_MIN_LENGTH } from "@/features/tours/models/tours-new-validation-messages";

import { denaliGearItemSchema } from "./denaliGearItemSchema";
import {
  denaliImageFileAssetSchema,
  DENALI_MAX_PHOTO_COUNT,
} from "./denaliFileAssetSchema";
import {
  denaliItineraryDayRowSchema,
  optionalApproximateReturnTimeSchema,
} from "./denaliItineraryDaySchema";
import { denaliGatheringPickupStationFormSchema } from "./denaliGatheringPickupStation.schema";
import { denaliLocationDataSchema } from "./denaliLocationDataSchema";

function optionalInt(minMessage?: string) {
  return z
    .union([z.number().int().min(0, minMessage), z.nan(), z.undefined(), z.null(), z.literal("")])
    .transform((v) => (v == null || Number.isNaN(v) || v === "" ? undefined : v))
    .optional();
}

function optionalPositiveInt(min = 1, message?: string) {
  return z
    .union([z.number().int().min(min, message), z.nan(), z.undefined(), z.null(), z.literal("")])
    .transform((v) => (v == null || Number.isNaN(v) || v === "" ? undefined : v))
    .optional();
}

function isParsableIsoDateTime(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !Number.isNaN(Date.parse(trimmed));
}

const denaliTourKindSchema = z.enum(
  DENALI_TOUR_KIND_VALUES as unknown as [DenaliTourKind, ...DenaliTourKind[]],
);

const denaliTransportModeSchema = z.enum([
  "organizer_vehicle",
  "bus",
  "minibus",
  "train",
  "shared_cars",
  "none",
]);

const denaliBasicInfoSchema = z.object({
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

const denaliProgramNatureSchema = z.object({
  altitudeMeasurement: optionalInt("مقدار نمی‌تواند منفی باشد."),
  difficultyLevel: z.number().min(1).max(10).optional(),
  hikingGoHours: optionalPositiveInt(1),
  hikingHoursApprox: optionalPositiveInt(1),
  hikingReturnHours: optionalPositiveInt(1),
  itinerary: z.array(denaliItineraryDayRowSchema).optional(),
  longDescription: z.string().trim().optional(),
  shortDescription: z.string().trim().optional(),
  themeIds: z.array(z.string().trim()).default([]),
});

const denaliTransportSchema = z.object({
  adminCapacityApproval: z.boolean().optional(),
  allowPersonalCar: z.boolean().optional(),
  dongAmount: optionalInt("مقدار نمی‌تواند منفی باشد."),
  transportCost: optionalInt("مقدار نمی‌تواند منفی باشد."),
  transportMode: denaliTransportModeSchema,
});

const denaliPricingPaymentSchema = z.object({
  basePricePerPerson: optionalInt("مقدار نمی‌تواند منفی باشد."),
  includesTourInsurance: z.boolean().optional(),
  paymentMode: z.literal("offline_receipt").optional(),
  requiresPayment: z.boolean().optional(),
});

const denaliParticipantRequirementsSchema = z.object({
  fitnessLevel: z.enum(["low", "medium", "high"]).optional(),
  fitnessPrerequisiteText: z.string().trim().optional(),
  gearItems: z.array(denaliGearItemSchema).optional(),
  maximumAge: optionalInt("مقدار نمی‌تواند منفی باشد."),
  minimumAge: optionalInt("مقدار نمی‌تواند منفی باشد."),
  minRequiredPeaks: z.number().int().min(1).max(4).optional(),
  nationalIdRequired: z.boolean().optional(),
  sportsInsuranceRequired: z.boolean().optional(),
});

const denaliPoliciesSchema = z.object({
  cancellationDeadlineHours: optionalPositiveInt(1),
  cancellationPenaltyPercentage: optionalInt("مقدار نمی‌تواند منفی باشد."),
  policiesText: z.string().trim().optional(),
});

const denaliPhotosSchema = z.object({
  photos: z
    .array(denaliImageFileAssetSchema)
    .max(DENALI_MAX_PHOTO_COUNT, "حداکثر ۱۰ عکس مجاز است.")
    .optional(),
});

const denaliTourCreateObjectSchema = z.object({
  basicInfo: denaliBasicInfoSchema,
  programNature: denaliProgramNatureSchema,
  transport: denaliTransportSchema,
  pricingPayment: denaliPricingPaymentSchema,
  participantRequirements: denaliParticipantRequirementsSchema,
  policies: denaliPoliciesSchema,
  photosData: denaliPhotosSchema,
  tripDetails: z.object({
    logistics: z.object({
      gatheringPoints: z.array(denaliGatheringPickupStationFormSchema).default([]),
    }).default({ gatheringPoints: [] }),
  }).default({ logistics: { gatheringPoints: [] } }),
});

function rejectZeroAmount(
  value: unknown,
  ctx: z.RefinementCtx,
  path: (string | number)[],
  message: string,
): void {
  if (value === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  }
}

export const denaliTourCreateBaseSchema = denaliTourCreateObjectSchema.superRefine((data, ctx) => {
  rejectZeroAmount(
    data.basicInfo.capacityMax,
    ctx,
    ["basicInfo", "capacityMax"],
    "حداکثر ظرفیت باید حداقل ۱ باشد.",
  );
  rejectZeroAmount(
    data.transport.transportCost,
    ctx,
    ["transport", "transportCost"],
    "هزینه حمل‌ونقل باید بیشتر از صفر باشد.",
  );
  rejectZeroAmount(
    data.transport.dongAmount,
    ctx,
    ["transport", "dongAmount"],
    "مبلغ دنگ باید بیشتر از صفر باشد.",
  );
  if (data.pricingPayment.requiresPayment === true) {
    rejectZeroAmount(
      data.pricingPayment.basePricePerPerson,
      ctx,
      ["pricingPayment", "basePricePerPerson"],
      "قیمت باید بیشتر از صفر باشد.",
    );
  }
});

export type DenaliCreateTourWizardForm = z.infer<typeof denaliTourCreateBaseSchema>;
