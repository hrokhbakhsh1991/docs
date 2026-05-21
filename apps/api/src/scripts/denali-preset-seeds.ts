import {
  denaliTourKindToIsMultiDay,
  isDenaliEventTourKind,
  type DenaliTourKind,
} from "@repo/types";

/** Mirrors web `DENALI_PRESET_DEFAULTS_ROOT_KEYS` — keep in sync with tour-preset-defaults.schema.ts */
export const DENALI_PRESET_DEFAULTS_ROOT_KEYS = [
  "basicInfo",
  "programNature",
  "transport",
  "pricingPayment",
  "participantRequirements",
  "policies",
  "photosData",
] as const;

/** Shared baseline for all Denali workspace presets (6-tab JSON). */
export const DENALI_DEFAULT_PRESET_BASE: Record<string, unknown> = {
  basicInfo: {
    title: "abcdefghijabcdefghij",
    startDateTime: "2026-09-15T08:00:00.000Z",
    capacityMax: 16,
    meetingPoint: "محل تجمع — در ویزارد تکمیل کنید",
    gatheringPoint: {
      addressText: "تهران — میدان آزادی (نمونه)",
      latitude: 35.6997,
      longitude: 51.3381,
    },
    startPoint: {
      addressText: "روستای رینه (نمونه)",
      latitude: 35.9,
      longitude: 52.1,
    },
  },
  programNature: {
    shortDescription: "برنامه تور دنالی — جزئیات را در ویزارد تکمیل کنید.",
    longDescription: undefined,
    secondaryTourThemeIds: undefined,
    itineraryOutline: undefined,
    altitudeGainApprox: undefined,
  },
  transport: {
    transportMode: "organizer_vehicle",
    dongAmount: undefined,
    transportNotes: undefined,
  },
  pricingPayment: {
    requiresPayment: true,
    basePricePerPerson: 500_000,
    paymentMode: "offline_receipt",
  },
  participantRequirements: {
    minimumAge: 18,
    maximumAge: undefined,
    fitnessLevel: "medium",
    experienceLevel: "beginner",
    requiredGearIds: undefined,
    optionalGearIds: undefined,
    sportsInsuranceRequired: true,
    medicalNotes: undefined,
    technicalSkillNotes: undefined,
  },
  policies: {
    cancellationPolicy: "سیاست لغو نمونه — در ویزارد ویرایش کنید.",
    refundPolicy: "سیاست استرداد نمونه — در ویزارد ویرایش کنید.",
    safetyPolicy: undefined,
    attendanceRules: undefined,
  },
  photosData: {
    photos: [],
  },
};

function deepMergePresetSection<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown> | undefined,
): T {
  if (!override) return base;
  return { ...base, ...override } as T;
}

export function buildDenaliPresetDefaults(
  kind: DenaliTourKind,
  mainTourThemeId: string,
  shortDescription: string,
): Record<string, unknown> {
  const isMulti = denaliTourKindToIsMultiDay(kind);
  const isEvent = isDenaliEventTourKind(kind);
  const isMountain = kind.startsWith("mountain_");

  const basicInfo = deepMergePresetSection(
    DENALI_DEFAULT_PRESET_BASE.basicInfo as Record<string, unknown>,
    {
      tourType: kind,
      endDateTime: isMulti ? "2026-09-17T18:00:00.000Z" : undefined,
    },
  );

  const programNatureOverride: Record<string, unknown> = {
    mainTourThemeId,
    shortDescription,
    longDescription: isEvent ? "رویداد فرهنگی — مکان و زمان را در ویزارد تأیید کنید." : undefined,
    hikingHoursApprox: isEvent ? undefined : 4,
  };
  if (!isEvent) {
    programNatureOverride.difficultyLevel = "medium";
  }
  const programNature = deepMergePresetSection(
    DENALI_DEFAULT_PRESET_BASE.programNature as Record<string, unknown>,
    programNatureOverride,
  );
  if (isEvent) {
    delete (programNature as Record<string, unknown>).difficultyLevel;
    delete (programNature as Record<string, unknown>).hikingHoursApprox;
  }

  const transport = deepMergePresetSection(
    DENALI_DEFAULT_PRESET_BASE.transport as Record<string, unknown>,
    isEvent
      ? { transportMode: "none", dongAmount: undefined }
      : { transportMode: "shared_cars", dongAmount: 150_000 },
  );

  const pricingPayment = deepMergePresetSection(
    DENALI_DEFAULT_PRESET_BASE.pricingPayment as Record<string, unknown>,
    isEvent ? { requiresPayment: true, basePricePerPerson: 120_000 } : {},
  );

  const participantRequirements = deepMergePresetSection(
    DENALI_DEFAULT_PRESET_BASE.participantRequirements as Record<string, unknown>,
    {
      minimumAge: isEvent ? 16 : 18,
      fitnessLevel: isEvent ? "low" : "medium",
      sportsInsuranceRequired: isMountain,
    },
  );

  const policies = deepMergePresetSection(
    DENALI_DEFAULT_PRESET_BASE.policies as Record<string, unknown>,
    isEvent
      ? {
          attendanceRules: "حضور ۱۰ دقیقه قبل از شروع الزامی است.",
          safetyPolicy: undefined,
        }
      : {
          safetyPolicy: "رعایت دستور راهنما و تجهیزات ایمنی الزامی است.",
        },
  );

  return {
    basicInfo,
    programNature,
    transport,
    pricingPayment,
    participantRequirements,
    policies,
  };
}
