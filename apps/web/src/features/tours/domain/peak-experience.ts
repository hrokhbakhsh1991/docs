import type { TourType } from "@repo/types";

const OUTDOOR_TOUR_TYPES = new Set<TourType>(["mountain", "nature"]);

export const PEAK_EXPERIENCE_MIN_OPTIONS = [
  { value: 0, label: "غیرفعال (بدون تایید خودکار)" },
  { value: 1, label: "حداقل ۱ قله" },
  { value: 2, label: "حداقل ۲ قله" },
  { value: 3, label: "حداقل ۳ قله" },
  { value: 4, label: "حداقل ۴ قله" },
] as const;

export const USER_PAST_PEAKS_OPTIONS = [
  { value: 0, label: "بدون سابقه" },
  { value: 1, label: "۱ قله" },
  { value: 2, label: "۲ قله" },
  { value: 3, label: "۳ قله" },
  { value: 4, label: "۴ قله و بیشتر" },
] as const;

export function readTourMinRequiredPeaks(
  tripDetails: Record<string, unknown> | null | undefined,
): number | undefined {
  if (tripDetails == null || typeof tripDetails !== "object") {
    return undefined;
  }
  const requirements = tripDetails.requirements;
  if (requirements == null || typeof requirements !== "object" || Array.isArray(requirements)) {
    return undefined;
  }
  const raw = (requirements as Record<string, unknown>).minRequiredPeaks;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 4) {
    return undefined;
  }
  return raw;
}

export function tourShowsPeakExperienceIntake(input: {
  tourType?: TourType | null;
  tripDetails?: Record<string, unknown> | null;
}): boolean {
  if (input.tourType != null && OUTDOOR_TOUR_TYPES.has(input.tourType)) {
    return true;
  }
  const min = readTourMinRequiredPeaks(input.tripDetails ?? null);
  return min != null;
}

export function tourShowsPeakExperienceAdminField(input: {
  tourType?: TourType | null;
  formProfile?: string | null;
}): boolean {
  if (input.formProfile === "mountain_outdoor" || input.formProfile === "denali_pilot") {
    return true;
  }
  if (input.tourType != null && OUTDOOR_TOUR_TYPES.has(input.tourType)) {
    return true;
  }
  return false;
}
