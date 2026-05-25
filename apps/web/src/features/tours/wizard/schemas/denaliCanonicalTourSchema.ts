/**
 * Canonical submit authority for Denali create wizard.
 *
 * Strict Zod validation for {@link DenaliCanonicalTourModel} only — no legacy form fields.
 * Wired on submit via {@link ../denali/validation/denaliSubmitValidation.ts}.
 * Cross-field business rules: API {@link ../../../../api/src/modules/tours/utils/assert-create-tour-invariants.ts}.
 * Wizard required/visibility: {@link ../denali/rules/denaliRuleRequired.ts}.
 */

import {
  DENALI_CANONICAL_CATEGORY_VALUES,
  DENALI_CANONICAL_DURATION_VALUES,
  DENALI_CANONICAL_TRANSPORT_MODE_VALUES,
  isDenaliTransportDongAmountRequired,
  type DenaliCanonicalTourModel,
} from "@repo/types/denali";
import { z } from "zod";

import { TOUR_TITLE_MAX_LENGTH, TOUR_TITLE_MIN_LENGTH } from "@/features/tours/models/tours-new-validation-messages";

import { denaliGearItemSchema } from "./denaliGearItemSchema";
import { denaliLocationDataSchema } from "./denaliLocationDataSchema";
import {
  denaliCanonicalItineraryDayRowSchema,
  optionalApproximateReturnTimeSchema,
} from "./denaliItineraryDaySchema";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isParsableIsoDateTime(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !Number.isNaN(Date.parse(trimmed));
}

const denaliCanonicalCategorySchema = z.enum(DENALI_CANONICAL_CATEGORY_VALUES);

const denaliCanonicalDurationSchema = z.enum(DENALI_CANONICAL_DURATION_VALUES);

const denaliCanonicalTransportModeSchema = z.enum(DENALI_CANONICAL_TRANSPORT_MODE_VALUES);

const denaliCanonicalProgramSchema = z
  .object({
    themeIds: z.array(z.string().regex(UUID_V4, "شناسه تم معتبر نیست.")).default([]),
    shortDescription: z.string().trim().min(1, "توضیح کوتاه الزامی است."),
    longDescription: z.string().trim().optional(),
    difficultyLevel: z.number().min(1).max(10).default(5),
    hikingHoursApprox: z.number().int().min(1).optional(),
    hikingGoHours: z.number().int().min(1).optional(),
    hikingReturnHours: z.number().int().min(1).optional(),
    altitudeMeasurement: z.number().int().min(0, "ارتفاع نمی‌تواند منفی باشد.").optional(),
    itinerary: z.array(denaliCanonicalItineraryDayRowSchema).optional(),
  })
  .strict();

const denaliCanonicalGearItemSchema = denaliGearItemSchema.extend({
  id: z.string().regex(UUID_V4, "شناسه تجهیزات معتبر نیست."),
});

const denaliCanonicalTransportSchema = z
  .object({
    mode: denaliCanonicalTransportModeSchema,
    transportCost: z
      .number()
      .int("هزینه حمل‌ونقل باید عدد صحیح باشد.")
      .min(1, "هزینه حمل‌ونقل باید بیشتر از صفر باشد.")
      .optional(),
    allowPersonalCar: z.boolean().optional(),
    dongAmount: z
      .number()
      .int("مبلغ دنگ باید عدد صحیح باشد.")
      .min(1, "مبلغ دنگ باید بیشتر از صفر باشد.")
      .optional(),
    adminCapacityApproval: z.boolean().optional(),
    transportNotes: z.string().trim().optional(),
  })
  .strict();

const denaliCanonicalPricingSchema = z
  .object({
    requiresPayment: z.boolean().optional(),
    basePricePerPerson: z
      .number()
      .int("قیمت باید عدد صحیح باشد.")
      .min(1, "قیمت باید بیشتر از صفر باشد.")
      .optional(),
    paymentMode: z.enum(["offline_receipt"]),
    includesTourInsurance: z.boolean().optional(),
  })
  .strict();

const denaliCanonicalParticipantsSchema = z
  .object({
    minimumAge: z.number().int().min(0).optional(),
    maximumAge: z.number().int().min(0).optional(),
    fitnessLevel: z.enum(["low", "medium", "high"]).optional(),
    nationalIdRequired: z.boolean().optional(),
    sportsInsuranceRequired: z.boolean().optional(),
    minRequiredPeaks: z.number().int().min(1).max(4).optional(),
    fitnessPrerequisiteText: z.string().trim().optional(),
    gearItems: z.array(denaliCanonicalGearItemSchema).optional(),
  })
  .strict();

const denaliCanonicalPoliciesSchema = z
  .object({
    policiesText: z.string().trim().optional(),
    cancellationDeadlineHours: z.number().int().min(1).optional(),
    cancellationPenaltyPercentage: z.number().int().min(0).max(100).optional(),
  })
  .strict();

const denaliCanonicalPhotoSchema = z
  .object({
    id: z.string().regex(UUID_V4, "شناسه عکس معتبر نیست."),
    url: z.string().url("مسیر دسترسی معتبر نیست."),
    filename: z.string().trim().min(1, "نام فایل الزامی است."),
    size: z.number().int().min(0, "اندازه فایل نامعتبر است.").max(5 * 1024 * 1024, "اندازه فایل نباید بیشتر از ۵ مگابایت باشد."),
    mimeType: z.string().regex(/^image\/(jpeg|png|webp)$/, "فرمت فایل مجاز نیست."),
    uploadedAt: z.string().trim().refine(isParsableIsoDateTime, "زمان آپلود نامعتبر است."),
  })
  .strict();

const denaliCanonicalTourObjectSchema = z
  .object({
    category: denaliCanonicalCategorySchema,
    duration: denaliCanonicalDurationSchema,

    title: z
      .string()
      .trim()
      .min(TOUR_TITLE_MIN_LENGTH, `عنوان باید حداقل ${TOUR_TITLE_MIN_LENGTH} نویسه باشد.`)
      .max(TOUR_TITLE_MAX_LENGTH, `عنوان نباید بیشتر از ${TOUR_TITLE_MAX_LENGTH} نویسه باشد.`),
    destinationId: z.string().regex(UUID_V4, "مقصد معتبر انتخاب کنید."),
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
      }),
    capacityMax: z
      .number()
      .int("حداکثر ظرفیت باید عدد صحیح باشد.")
      .min(1, "حداکثر ظرفیت باید حداقل ۱ باشد.")
      .optional(),
    capacityMin: z.number().int().min(0).optional(),
    meetingPoint: z.string().trim().optional(),
    startPointLocationText: z.string().trim().optional(),
    gatheringPoint: denaliLocationDataSchema.optional(),
    gatheringPoints: z
      .array(
        z.object({
          id: z.string().optional(),
          title: z.string().default(""),
          time: z.string().optional(),
          location: denaliLocationDataSchema,
        }),
      )
      .optional(),
    startPoint: denaliLocationDataSchema.optional(),
    summitPoint: denaliLocationDataSchema.optional(),
    campPoint: denaliLocationDataSchema.optional(),
    endPoint: denaliLocationDataSchema.optional(),
    approximateReturnTime: optionalApproximateReturnTimeSchema(),
    leaderUserIds: z.array(z.string().regex(UUID_V4, "شناسه راهنمای workspace معتبر نیست.")).optional(),
    requiresLocalGuide: z.boolean().optional(),
    localGuideName: z.string().trim().optional(),
    requiresManualAdminApproval: z.boolean().optional(),
    socialMediaLink: z.string().trim().max(2048).optional(),
    /** Wizard-only: maps to API `lifecycle_status` on submit (`draft` → DRAFT, `active` → OPEN). */
    publishStatus: z.enum(["draft", "active"]).optional(),

    program: denaliCanonicalProgramSchema,
    transport: denaliCanonicalTransportSchema,
    pricing: denaliCanonicalPricingSchema,
    participants: denaliCanonicalParticipantsSchema,
    policies: denaliCanonicalPoliciesSchema,
    photos: z.array(denaliCanonicalPhotoSchema).max(10, "حداکثر ۱۰ عکس مجاز است.").optional(),
  });


function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Strict canonical tour schema — structural constraints + conditional numeric rules. */
export const denaliCanonicalTourSchema = denaliCanonicalTourObjectSchema.superRefine((data, ctx) => {
  if (data.duration === "multi") {
    const end = data.endDateTime?.trim();
    if (end == null || end === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDateTime"],
        message: "زمان پایان برای تور چندروزه الزامی است.",
      });
    }
  }

  const startMs = Date.parse(data.startDateTime.trim());
  const endRaw = data.endDateTime?.trim();
  if (endRaw != null && endRaw !== "" && !Number.isNaN(startMs)) {
    const endMs = Date.parse(endRaw);
    if (!Number.isNaN(endMs) && endMs <= startMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDateTime"],
        message: "زمان پایان باید بعد از زمان شروع باشد.",
      });
    }
  }

  if (data.capacityMax == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capacityMax"],
      message: "حداکثر ظرفیت الزامی است.",
    });
  } else if (!isPositiveInt(data.capacityMax)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capacityMax"],
      message: "حداکثر ظرفیت باید حداقل ۱ باشد.",
    });
  }

  if (data.capacityMax != null && data.capacityMin != null && data.capacityMin > data.capacityMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capacityMin"],
      message: "حداقل ظرفیت نمی‌تواند بیشتر از حداکثر ظرفیت باشد.",
    });
  }

  if (
    isDenaliTransportDongAmountRequired({
      mode: data.transport.mode,
      allowPersonalCar: data.transport.allowPersonalCar,
    }) &&
    !isPositiveInt(data.transport.dongAmount)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["transport", "dongAmount"],
      message: "مبلغ دنگ برای خودرو شخصی الزامی است.",
    });
  }

  if (data.pricing.requiresPayment === true && !isPositiveInt(data.pricing.basePricePerPerson)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pricing", "basePricePerPerson"],
      message: "قیمت به ازای هر نفر برای تور پولی الزامی است.",
    });
  }

  if (data.category === "mountain") {
    if (!isPositiveInt(data.program.altitudeMeasurement)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["program", "altitudeMeasurement"],
        message: "حداکثر ارتفاع برای تور کوهنوردی الزامی است.",
      });
    }
    if (data.participants.sportsInsuranceRequired !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants", "sportsInsuranceRequired"],
        message: "بیمه ورزشی برای تور کوهنوردی الزامی است.",
      });
    }
  }

  if (
    data.participants.minimumAge != null &&
    data.participants.maximumAge != null &&
    data.participants.minimumAge > data.participants.maximumAge
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["participants", "maximumAge"],
      message: "حداکثر سن نمی‌تواند کمتر از حداقل سن باشد.",
    });
  }

  if (data.duration === "multi") {
    const rows = data.program.itinerary ?? [];
    if (rows.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["program", "itinerary"],
        message: "برنامه روزانه برای تور چندروزه الزامی است.",
      });
    } else {
      for (let i = 0; i < rows.length; i += 1) {
        if (rows[i]!.activities.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["program", "itinerary", i, "activities"],
            message: "حداقل یک فعالیت برای هر روز الزامی است.",
          });
        }
      }
    }
  }
});

export function parseDenaliCanonicalTour(input: unknown): DenaliCanonicalTourModel {
  return denaliCanonicalTourSchema.parse(input);
}

export function safeParseDenaliCanonicalTour(input: unknown) {
  return denaliCanonicalTourSchema.safeParse(input);
}
