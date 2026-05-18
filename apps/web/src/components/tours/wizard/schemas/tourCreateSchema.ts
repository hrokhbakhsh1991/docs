import { z } from "zod";

import { ACCOMMODATION_TYPE_VALUES, TOUR_TYPES, type TourFormProfile } from "@repo/types";

import {
  DIFFICULTY_LEVELS,
  EXPERIENCE_LEVELS,
  TRIP_STYLES,
} from "@/features/tours/models/tourTripDetails.schema";
import { TOUR_TITLE_MAX_LENGTH, TOUR_TITLE_MIN_LENGTH } from "@/features/tours/models/tours-new-validation-messages";
import { inactiveTourCreateRootKeysForProfile } from "@/features/tours/wizard/fieldGroups";

import {
  mergeTourValidationFlagsForSchema,
  tourFormProfileToWizardValidationFlags,
  type TourCreateWizardValidationFlags,
} from "./tourCreateValidationPolicy";

const hhmmRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIMARY_TRANSPORT_MODES = ["plane", "train", "bus", "midibus", "private_car"] as const;

/**
 * RHF + `<select>` use `""` for “unset”. Prefer `union + transform` over `z.preprocess` here so Zod’s
 * inferred output stays typed (Zod v4 preprocess defaults can widen to `unknown` and break RHF resolvers).
 */
const optionalOverviewUuid = z
  .union([z.string().uuid(), z.literal(""), z.undefined()])
  .transform((v) => (v === "" ? undefined : v));

const optionalLogisticsPrimaryTransport = z
  .union([z.enum(PRIMARY_TRANSPORT_MODES), z.literal(""), z.undefined()])
  .transform((v) => (v === "" ? undefined : v));

const accommodationTypesEnumSchema = z.enum(
  ACCOMMODATION_TYPE_VALUES as unknown as [string, ...string[]],
);

const ACCOMMODATION_SLUG_SET = new Set<string>(ACCOMMODATION_TYPE_VALUES);

/** Strips invalid entries from localStorage / legacy drafts (free-text lines) before RHF + zod see the value. */
export function sanitizeWizardAccommodationTypes(
  raw: string[] | undefined | null,
): (typeof ACCOMMODATION_TYPE_VALUES)[number][] | undefined {
  if (raw == null || raw.length === 0) return undefined;
  const filtered = raw.filter(
    (x): x is (typeof ACCOMMODATION_TYPE_VALUES)[number] =>
      typeof x === "string" && ACCOMMODATION_SLUG_SET.has(x),
  );
  const sorted = [...new Set(filtered)].sort((a, b) => a.localeCompare(b));
  return sorted.length > 0 ? sorted : undefined;
}

/** Accept empty / omitted; HH:mm only when present. Avoids pipe output mismatch with react-hook-form. */
function optionalHhmm(fieldLabel: string) {
  return z
    .string()
    .optional()
    .refine((v) => v == null || v.trim() === "" || hhmmRegex.test(v.trim()), {
      message: `${fieldLabel} باید خالی باشد یا به صورت HH:mm (۲۴ ساعته).`,
    });
}

function optionalInt(minMessage?: string) {
  return z
    .union([z.number().int().min(0, minMessage), z.nan(), z.undefined(), z.null(), z.literal("")])
    .transform((v) => (v == null || Number.isNaN(v) || v === "" ? undefined : v))
    .optional();
}

function optionalNumber(minMessage?: string) {
  return z
    .union([z.number().min(0, minMessage), z.nan(), z.undefined(), z.null(), z.literal("")])
    .transform((v) => (v == null || Number.isNaN(v) || v === "" ? undefined : v))
    .optional();
}


function computeDurationDaysFromYmd(start: string, end: string): number | undefined {
  if (!ymdRegex.test(start) || !ymdRegex.test(end)) return undefined;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return undefined;
  if (endDate < startDate) return undefined;
  const ms = endDate.getTime() - startDate.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

const itinerarySegmentSchema = z
  .object({
    title: z.string().trim().optional(),
    description: z.string().trim().optional(),
    activityType: z
      .union([z.enum(["summit", "trek", "hike", "transfer", "cultural", "social", "rest", "other"]), z.literal(""), z.undefined(), z.null()])
      .transform((v) => (v === "" || v == null ? undefined : v)),
    maxAltitudeMeters: optionalInt("ارتفاع نمی‌تواند منفی باشد."),
    elevationGainMeters: optionalInt("اختلاف ارتفاع نمی‌تواند منفی باشد."),
    distanceKm: optionalNumber(),
    estimatedDurationHours: optionalNumber(),
    startTime: optionalHhmm("زمان شروع"),
    endTime: optionalHhmm("زمان پایان"),
    locationName: z.string().trim().optional(),
  })
  .superRefine((seg, ctx) => {
    if (seg.startTime && seg.endTime && seg.endTime < seg.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "زمان پایان باید بعد از زمان شروع باشد.",
      });
    }
  });

function buildItineraryDaySchemaForProfile(getVf: () => TourCreateWizardValidationFlags) {
  return z
    .object({
      dayNumber: z.number().int().min(1),
      title: z.string().trim().optional(),
      description: z.string().trim().optional(),
      segments: z.array(itinerarySegmentSchema).min(1, "هر روز باید حداقل یک بخش داشته باشد."),
    })
    .superRefine((day, ctx) => {
      const vf = getVf();
      if (!vf.relaxItineraryMinDays && !(day.title ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "عنوان روز الزامی است.",
          path: ["title"],
        });
      }
    });
}

export function buildTourCreateSchemaForFormProfile(
  profile: TourFormProfile,
  options?: {
    strictUnknownKeys?: boolean;
    useProfileDerivedValidationFlags?: boolean;
    /**
     * `submit`: full wizard completeness (default). `draft`: post-merge / RHF-shaped state — strict keys
     * and profile-aware refinements, but omits submit-time completeness (title length, descriptions,
     * logistics primary when the logistics group is active).
     */
    tourWizardValidationMode?: "submit" | "draft";
  },
) {
  const inactiveRoots = new Set(inactiveTourCreateRootKeysForProfile(profile));
  const profileDerivedVf = options?.useProfileDerivedValidationFlags === true ? tourFormProfileToWizardValidationFlags(profile) : null;
  const getVf = (): TourCreateWizardValidationFlags => profileDerivedVf ?? mergeTourValidationFlagsForSchema();
  const itineraryDayResolved = buildItineraryDaySchemaForProfile(getVf);
  const isDraftMode = options?.tourWizardValidationMode === "draft";

  const overviewTitleSchema = isDraftMode
    ? z.string().trim().max(TOUR_TITLE_MAX_LENGTH, `عنوان نباید بیشتر از ${TOUR_TITLE_MAX_LENGTH} نویسه باشد.`)
    : z
        .string()
        .trim()
        .min(TOUR_TITLE_MIN_LENGTH, `عنوان باید حداقل ${TOUR_TITLE_MIN_LENGTH} نویسه باشد.`)
        .max(TOUR_TITLE_MAX_LENGTH, `عنوان نباید بیشتر از ${TOUR_TITLE_MAX_LENGTH} نویسه باشد.`);

  const tourWizardRoot = z.object({
    /** وقتی true باشد، ثبت‌نام بدون تأیید دستی مستقیماً به وضعیت پذیرفته‌شده می‌رود (مگر جریان پرداخت متفاوت تعریف شود). */
    autoAcceptRegistrations: z.boolean().optional(),
    overview: z.object({
      title: overviewTitleSchema,
      slug: z.string().trim().optional(),
      mainTourThemeId: optionalOverviewUuid,
      secondaryTourThemeIds: z.array(z.string().uuid()).optional(),
      tourType: z.string().trim().optional(),
      tripStyles: z.array(z.string().trim()).optional(),
      shortDescription: z.string().trim().max(220, "توضیح کوتاه نباید بیشتر از ۲۲۰ کاراکتر باشد.").optional(),
      longDescription: z.string().trim().optional(),
      highlights: z.array(z.string().trim()).optional(),
      locationSummary: z.string().trim().optional(),
      /** ارسالی به سرور به‌صورت chat_link؛ لینک گروه هماهنگی بعد از ثبت‌نام موفق. */
      communicationLink: z.string().trim().max(2048, "طول لینک بیش از حد است.").optional(),
    }),
    pricing: z.object({
      basePrice: z.number().min(0, "قیمت نمی‌تواند منفی باشد."),
      currency: z.string().trim().optional(),
      requiresPayment: z.boolean().optional(),
      discountNotes: z.string().trim().optional(),
    }),
    schedule: z.object({
      startDate: z.string().trim().optional(),
      endDate: z.string().trim().optional(),
      departureMeetingTime: optionalHhmm("زمان قرار ملاقات"),
      returnMeetingTime: optionalHhmm("زمان بازگشت"),
    }),
    location: z.object({
      regionId: z.string().trim().optional(),
      mainDestinationId: z.string().trim().optional(),
      secondaryDestinationIds: z.array(z.string().trim()).optional(),
      meetingPoint: z.string().trim().optional(),
      returnPoint: z.string().trim().optional(),
      displayLocation: z.string().trim().optional(),
    }),
    itinerary: z.object({
      days: z.array(itineraryDayResolved),
    }),
    participation: z.object({
      requiredExperienceLevel: z.string().trim().optional(),
      requiredFitnessLevel: z.string().trim().optional(),
      minParticipants: optionalInt(),
      minimumAge: optionalInt(),
      maximumAge: optionalInt(),
      genderRestriction: z.string().trim().optional(),
      technicalSkillRequired: z.string().trim().optional(),
      medicalRestrictions: z.string().trim().optional(),
      requirements: z.string().trim().optional(),
      skillsRequired: z.array(z.string().trim()).optional(),
      gearRequiredIds: z.array(z.string().trim().refine((id) => !id || uuidV4.test(id), { message: "شناسه نامعتبر" })).optional(),
      gearOptionalIds: z.array(z.string().trim().refine((id) => !id || uuidV4.test(id), { message: "شناسه نامعتبر" })).optional(),
      documentsRequired: z.array(z.string().trim()).optional(),
      suitableFor: z.array(z.string().trim()).optional(),
      notSuitableFor: z.array(z.string().trim()).optional(),
      sportsInsuranceRequired: z.boolean().optional(),
      registrationNationalIdRequired: z.boolean().optional(),
    }),
    logistics: z.object({
      primaryTransportMode: optionalLogisticsPrimaryTransport,
      /**
       * When primary is not `private_car`, organizer may mark that some participants / legs use personal cars.
       * Must be false when primary is `private_car` (UI hides; Zod rejects inconsistent payloads).
       */
      supplementalPrivateCar: z.boolean().optional(),
      fuelShareToman: optionalInt("دنگ بنزین نمی‌تواند منفی باشد."),
      includedServices: z.string().trim().optional(),
      excludedServices: z.string().trim().optional(),
      meetingPointDetails: z.string().trim().optional(),
      transportationDetails: z.string().trim().optional(),
      accommodationDetails: z.string().trim().optional(),
      transportationNotes: z.string().trim().optional(),
      accommodationTypes: z.array(accommodationTypesEnumSchema).optional(),
      accommodationNotes: z.string().trim().optional(),
      mealPlan: z.string().trim().optional(),
      mealNotes: z.string().trim().optional(),
      supportServices: z.array(z.string().trim()).optional(),
      optionalServices: z.array(z.string().trim()).optional(),
      leaderProvidesInsurance: z.boolean().optional(),
      leaderInsuranceNotes: z.string().trim().max(500, "توضیح بیمه نباید بیشتر از ۵۰۰ نویسه باشد.").optional(),
      guideLanguageIds: z.array(z.string().trim().refine((id) => !id || uuidV4.test(id), { message: "شناسه نامعتبر" })).optional(),
      groupSizeMin: optionalInt(),
      groupSizeMax: optionalInt(),
    }),
    policies: z.object({
      cancellationPolicy: z.string().trim().optional(),
      refundPolicy: z.string().trim().optional(),
      safetyNotes: z.string().trim().optional(),
      riskDisclaimer: z.string().trim().optional(),
      attendanceRules: z.string().trim().optional(),
      lateArrivalPolicy: z.string().trim().optional(),
      noShowPolicy: z.string().trim().optional(),
      confirmationPolicy: z.string().trim().optional(),
      capacityPolicy: z.string().trim().optional(),
      safetyPolicy: z.string().trim().optional(),
      weatherPolicy: z.string().trim().optional(),
      reservationRules: z.string().trim().optional(),
    }),
  });
  const branch = options?.strictUnknownKeys ? tourWizardRoot.strict() : tourWizardRoot;
  return branch.superRefine((values, ctx) => {
    const vf = getVf();

    if (!inactiveRoots.has("itinerary") && !vf.relaxItineraryMinDays && values.itinerary.days.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "حداقل یک روز برای برنامه سفر تعریف کنید.",
        path: ["itinerary", "days"],
      });
    }

    const shortText = (values.overview.shortDescription ?? "").trim();
    const longText = (values.overview.longDescription ?? "").trim();
    if (!isDraftMode && !shortText && !longText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "حداقل یکی از توضیح کوتاه یا توضیح کامل باید وارد شود.",
        path: ["overview", "shortDescription"],
      });
    }

    const mainId = values.overview.mainTourThemeId;
    const secondary = values.overview.secondaryTourThemeIds ?? [];
    if (mainId && secondary.includes(mainId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تم اصلی نباید در تم‌های فرعی هم انتخاب شود.",
        path: ["overview", "secondaryTourThemeIds"],
      });
    }

    const start = (values.schedule.startDate ?? "").trim();
    const end = (values.schedule.endDate ?? "").trim();
    if (start || end) {
      if (start && !ymdRegex.test(start)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "تاریخ شروع نامعتبر است.", path: ["schedule", "startDate"] });
      }
      if (end && !ymdRegex.test(end)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "تاریخ پایان نامعتبر است.", path: ["schedule", "endDate"] });
      }
      if (start && end && ymdRegex.test(start) && ymdRegex.test(end) && end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "تاریخ پایان باید بعد از تاریخ شروع باشد.",
          path: ["schedule", "endDate"],
        });
      }
    }

    if (!inactiveRoots.has("itinerary")) {
      const maxDaysBySchedule = start && end ? computeDurationDaysFromYmd(start, end) : undefined;
      if (maxDaysBySchedule != null && values.itinerary.days.length > maxDaysBySchedule) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `تعداد روزهای برنامه سفر نمی‌تواند بیشتر از ${maxDaysBySchedule} روز باشد.`,
          path: ["itinerary", "days"],
        });
      }
    }

    const departureMeetingTime = (values.schedule.departureMeetingTime ?? "").trim();
    const returnMeetingTime = (values.schedule.returnMeetingTime ?? "").trim();
    if (departureMeetingTime && returnMeetingTime && returnMeetingTime <= departureMeetingTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ساعت بازگشت باید بعد از ساعت رفت باشد.",
        path: ["schedule", "returnMeetingTime"],
      });
    }

    if (
      !isDraftMode &&
      values.pricing.requiresPayment === true &&
      (!(Number.isFinite(values.pricing.basePrice) && values.pricing.basePrice > 0))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "برای تور پولی باید قیمت پایه بیشتر از صفر باشد.",
        path: ["pricing", "basePrice"],
      });
    }

    if (!inactiveRoots.has("logistics")) {
      const minL = values.logistics.groupSizeMin;
      const maxL = values.logistics.groupSizeMax;
      if (minL != null && maxL != null && maxL < minL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "حداکثر اندازه گروه باید بیشتر یا مساوی حداقل باشد.",
          path: ["logistics", "groupSizeMax"],
        });
      }
    }

    const tourType = values.overview.tourType?.trim();
    if (tourType && !(TOUR_TYPES as readonly string[]).includes(tourType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "نوع تور نامعتبر است.",
        path: ["overview", "tourType"],
      });
    }

    const tripStyles = values.overview.tripStyles;
    if (tripStyles?.length) {
      const bad = tripStyles.find((s) => s && !(TRIP_STYLES as readonly string[]).includes(s));
      if (bad) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `سبک سفر نامعتبر: ${bad}`,
          path: ["overview", "tripStyles"],
        });
      }
    }

    if (!inactiveRoots.has("participation")) {
      const exp = values.participation.requiredExperienceLevel?.trim();
      if (exp && !(EXPERIENCE_LEVELS as readonly string[]).includes(exp as (typeof EXPERIENCE_LEVELS)[number])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "سطح تجربه نامعتبر است.",
          path: ["participation", "requiredExperienceLevel"],
        });
      }

      const fit = values.participation.requiredFitnessLevel?.trim();
      if (fit && !(DIFFICULTY_LEVELS as readonly string[]).includes(fit as (typeof DIFFICULTY_LEVELS)[number])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "سطح آمادگی جسمانی نامعتبر است.",
          path: ["participation", "requiredFitnessLevel"],
        });
      }

      const gen = values.participation.genderRestriction?.trim();
      if (gen && !["none", "male_only", "female_only"].includes(gen)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "محدودیت جنسیت نامعتبر است.",
          path: ["participation", "genderRestriction"],
        });
      }
    }

    const mainDestinationId = values.location.mainDestinationId?.trim();
    const regionId = values.location.regionId?.trim();
    if (regionId && !uuidV4.test(regionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "شناسه منطقه نامعتبر است.",
        path: ["location", "regionId"],
      });
    }
    if (mainDestinationId && !uuidV4.test(mainDestinationId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "شناسه مقصد اصلی نامعتبر است.",
        path: ["location", "mainDestinationId"],
      });
    }
    if (mainDestinationId && !regionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "با انتخاب مقصد اصلی، انتخاب منطقه نیز الزامی است.",
        path: ["location", "regionId"],
      });
    }
    const secondaryDestinationIds = values.location.secondaryDestinationIds ?? [];
    const badSecondary = secondaryDestinationIds.find((id) => id && !uuidV4.test(id.trim()));
    if (badSecondary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "یکی از شناسه‌های مقصد ثانویه نامعتبر است.",
        path: ["location", "secondaryDestinationIds"],
      });
    }
    if (mainDestinationId && secondaryDestinationIds.some((id) => id === mainDestinationId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "مقصد اصلی نباید در مقصدهای ثانویه تکرار شود.",
        path: ["location", "secondaryDestinationIds"],
      });
    }

    if (!inactiveRoots.has("logistics") && !isDraftMode) {
      if (!vf.relaxLogisticsPrimary && !values.logistics.primaryTransportMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "حمل‌ونقل اصلی سفر را انتخاب کنید.",
          path: ["logistics", "primaryTransportMode"],
        });
      }

      const primaryTm = values.logistics.primaryTransportMode;
      const supplemental = values.logistics.supplementalPrivateCar === true;
      if (!vf.relaxLogisticsPrimary) {
        if (primaryTm === "private_car" && supplemental) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "وقتی حمل‌ونقل اصلی خودرو شخصی است، گزینهٔ «همچنین خودرو شخصی» باید خاموش باشد.",
            path: ["logistics", "supplementalPrivateCar"],
          });
        }

        const needsFuelShare = supplemental || primaryTm === "private_car";
        if (needsFuelShare && values.logistics.fuelShareToman == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              primaryTm === "private_car"
                ? "برای حالت خودرو شخصی، مبلغ دنگ بنزین را مشخص کنید."
                : "با فعال‌کردن خودرو شخصی کنار حمل اصلی، مبلغ دنگ بنزین را برای سرنشینان مشخص کنید.",
            path: ["logistics", "fuelShareToman"],
          });
        }
      }
    }
  });
}

export const tourCreateSchema = buildTourCreateSchemaForFormProfile("general");

export type TourCreateFormValues = z.infer<typeof tourCreateSchema>;
