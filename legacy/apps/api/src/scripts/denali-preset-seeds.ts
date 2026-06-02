import type { DenaliTourKind } from "@repo/types";

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

/**
 * Blank-slate preset defaults: only tour kind + theme binding — no factory titles, geo pins, or policy text.
 */
export function buildDenaliPresetDefaults(
  kind: DenaliTourKind,
  mainTourThemeId: string,
): Record<string, unknown> {
  const isMountain = kind.startsWith("mountain_");
  const isEvent = kind.startsWith("event_");
  return {
    basicInfo: {
      tourType: kind,
      capacityMax: 12,
      startDateTime: "2026-08-10T08:00:00.000Z",
    },
    programNature: {
      mainTourThemeId,
      shortDescription: "توضیح کوتاه پیش‌فرض قالب دنالی برای تست E2E",
      ...(isEvent ? {} : { difficultyLevel: 5, hikingHoursApprox: 4 }),
      ...(isMountain && !isEvent ? { altitudeMeasurement: 4200 } : {}),
    },
    transport: {
      mode: "organizer_vehicle",
    },
    pricingPayment: {
      requiresPayment: true,
      basePricePerPerson: 100_000,
      paymentMode: "offline_receipt",
    },
    participantRequirements: {
      minimumAge: isEvent ? 16 : 18,
      fitnessLevel: isEvent ? "low" : "medium",
      sportsInsuranceRequired: isMountain,
    },
    policies: {
      policiesText: "سیاست لغو تست E2E",
    },
    photosData: { photos: [] },
  };
}
