/**
 * @deprecated Removed from submit / wizard / mapper runtime pipeline (Phase 5).
 * Use {@link ./denaliCanonicalTourSchema.ts} via {@link ../denali/validation/denaliSubmitValidation.ts}.
 *
 * Retained for unit tests only (not product submit/resolver paths).
 */

import { z } from "zod";

import { DENALI_TOUR_KIND_VALUES, type DenaliTourKind } from "@repo/types";

import { TOUR_TITLE_MAX_LENGTH, TOUR_TITLE_MIN_LENGTH } from "@/features/tours/models/tours-new-validation-messages";

import { denaliGearItemSchema } from "./denaliGearItemSchema";
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

const denaliBasicInfoSchema = z.object({
  title: z
    .string()
    .trim()
    .max(TOUR_TITLE_MAX_LENGTH, `عنوان نباید بیشتر از ${TOUR_TITLE_MAX_LENGTH} نویسه باشد.`)
    .refine(
      (v) => v.length === 0 || v.length >= TOUR_TITLE_MIN_LENGTH,
      `عنوان باید حداقل ${TOUR_TITLE_MIN_LENGTH} نویسه باشد.`,
    ),
  tourType: denaliTourKindSchema,
  destinationId: z.string().trim().optional(),
  startDateTime: z
    .string()
    .trim()
    .refine(isParsableIsoDateTime, "زمان شروع باید به‌صورت ISO datetime معتبر باشد."),
  endDateTime: z
    .string()
    .trim()
    .optional()
    .refine((v) => v == null || v === "" || isParsableIsoDateTime(v), {
      message: "زمان پایان باید به‌صورت ISO datetime معتبر باشد.",
    })
    .transform((v) => (v == null || v === "" ? undefined : v)),
  capacityMin: optionalInt("حداقل ظرفیت نمی‌تواند منفی باشد."),
  capacityMax: z.number().int().optional(),
  meetingPoint: z.string().trim().optional(),
  startPointLocationText: z.string().trim().optional(),
  startPoint: denaliLocationDataSchema.optional(),
  summitPoint: denaliLocationDataSchema.optional(),
  campPoint: denaliLocationDataSchema.optional(),
  endPoint: denaliLocationDataSchema.optional(),
  approximateReturnTime: optionalApproximateReturnTimeSchema(),
  leaderUserIds: z.array(z.string().trim().min(1)).default([]),
  requiresLocalGuide: z.boolean().optional(),
  localGuideName: z.string().trim().optional(),
  requiresManualAdminApproval: z.boolean().optional(),
  socialMediaLink: z.string().trim().max(2048).optional(),
  /** Wizard-only: maps to API `lifecycle_status` on submit (`draft` → DRAFT, `active` → OPEN). */
  publishStatus: z.enum(["draft", "active"]).optional(),
});

const denaliProgramNatureSchema = z.object({
  themeIds: z.array(z.string().trim()).default([]),
  shortDescription: z.string().trim().optional(),
  longDescription: z.string().trim().optional(),
  difficultyLevel: z.number().min(1).max(10).optional(),
  hikingHoursApprox: optionalPositiveInt(1),
  hikingGoHours: optionalPositiveInt(1),
  hikingReturnHours: optionalPositiveInt(1),
  altitudeMeasurement: optionalInt("ارتفاع نمی‌تواند منفی باشد."),
  itinerary: z.array(denaliItineraryDayRowSchema).optional(),
});

const denaliTransportModeSchema = z.enum([
  "organizer_vehicle",
  "bus",
  "minibus",
  "train",
  "shared_cars",
  "none",
]);

const denaliTransportSchema = z.object({
  transportMode: denaliTransportModeSchema,
  transportCost: optionalInt("هزینه حمل‌ونقل نمی‌تواند منفی باشد."),
  allowPersonalCar: z.boolean().optional(),
  dongAmount: optionalInt("مبلغ دنگ نمی‌تواند منفی باشد."),
  transportNotes: z.string().trim().optional(),
});

const denaliPricingPaymentSchema = z.object({
  requiresPayment: z.boolean().optional(),
  basePricePerPerson: optionalInt("قیمت نمی‌تواند منفی باشد."),
  paymentMode: z.literal("offline_receipt").optional(),
  includesTourInsurance: z.boolean().optional(),
});

const denaliParticipantRequirementsSchema = z.object({
  minimumAge: optionalInt("حداقل سن نمی‌تواند منفی باشد."),
  maximumAge: optionalInt("حداکثر سن نمی‌تواند منفی باشد."),
  fitnessLevel: z.enum(["low", "medium", "high"]).optional(),
  nationalIdRequired: z.boolean().optional(),
  sportsInsuranceRequired: z.boolean().optional(),
  minRequiredPeaks: z.number().int().min(1).max(4).optional(),
  fitnessPrerequisiteText: z.string().trim().optional(),
  gearItems: z.array(denaliGearItemSchema).optional(),
});

const denaliPoliciesSchema = z.object({
  policiesText: z.string().trim().optional(),
  cancellationDeadlineHours: optionalPositiveInt(1, "مهلت لغو باید حداقل ۱ ساعت باشد."),
  cancellationPenaltyPercentage: optionalInt("درصد جریمه نمی‌تواند منفی باشد."),
});

export const denaliPhotosSchema = z.object({
  photos: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        filename: z.string(),
        size: z.number(),
        mimeType: z.string(),
        uploadedAt: z.string(),
      }),
    )
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

/**
 * Legacy 6-tab object shape — structural types + explicit rejection of zero amounts (no coercion).
 */
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

/** Stable UUIDs for unit tests only — not valid workspace catalog rows. */
export const DENALI_WIZARD_TEST_DESTINATION_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
export const DENALI_WIZARD_TEST_THEME_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

import { buildDenaliDefaultGatheringPoints } from "@/features/tours/wizard/denali/denaliDefaultGatheringPoints";
export function buildDenaliTourCreateDefaultValues(): DenaliCreateTourWizardForm {
  return {
    basicInfo: {
      title: "",
      tourType: undefined as unknown as import("@repo/types").DenaliTourKind,
      destinationId: undefined,
      startDateTime: "",
      endDateTime: undefined,
      capacityMin: undefined,
      capacityMax: undefined,
      meetingPoint: undefined,
      startPointLocationText: undefined,
      approximateReturnTime: undefined,
      leaderUserIds: [],
      requiresLocalGuide: false,
      localGuideName: undefined,
      requiresManualAdminApproval: false,
      socialMediaLink: undefined,
      publishStatus: "draft",
    },
    programNature: {
      themeIds: [],
      shortDescription: undefined,
      longDescription: undefined,
      difficultyLevel: undefined,
      hikingHoursApprox: undefined,
      hikingGoHours: undefined,
      hikingReturnHours: undefined,
      altitudeMeasurement: undefined,
      itinerary: [],
    },
    transport: {
      transportMode: "none",
      dongAmount: undefined,
      transportNotes: undefined,
    },
    pricingPayment: {
      requiresPayment: false,
      basePricePerPerson: undefined,
      paymentMode: undefined,
      includesTourInsurance: false,
    },
    participantRequirements: {
      minimumAge: undefined,
      maximumAge: undefined,
      fitnessLevel: undefined,
      nationalIdRequired: false,
      sportsInsuranceRequired: false,
      minRequiredPeaks: undefined,
      fitnessPrerequisiteText: undefined,
      gearItems: [],
    },
    policies: {
      policiesText: undefined,
      cancellationDeadlineHours: undefined,
      cancellationPenaltyPercentage: undefined,
    },
    photosData: {
      photos: [],
    },
    tripDetails: {
      logistics: {
        gatheringPoints: buildDenaliDefaultGatheringPoints(),
      },
    },
  };
}

/** Full fixture shape for tests that require UUID-shaped catalog fields. */
export function buildDenaliTourCreateTestValues(): DenaliCreateTourWizardForm {
  const base = buildDenaliTourCreateDefaultValues();
  return {
    ...base,
    basicInfo: {
      ...base.basicInfo,
      title: "صعود به قله دماوند - جبهه جنوبی",
      destinationId: DENALI_WIZARD_TEST_DESTINATION_ID,
      capacityMax: 15,
      publishStatus: "draft",
    },
    programNature: {
      ...base.programNature,
      themeIds: [DENALI_WIZARD_TEST_THEME_ID],
      shortDescription: "یک برنامه جذاب برای صعود به بام ایران.",
      difficultyLevel: 5,
      hikingHoursApprox: 8,
      altitudeMeasurement: 5610,
    },
    pricingPayment: {
      ...base.pricingPayment,
      requiresPayment: true,
      paymentMode: "offline_receipt",
      basePricePerPerson: 500_000,
    },
    participantRequirements: {
      ...base.participantRequirements,
      minimumAge: 18,
      fitnessLevel: "medium",
      sportsInsuranceRequired: true,
    },
  };
}
