import type { DifficultyLevel, ExperienceLevel, GenderRestriction } from "@/features/tours/models/tourTripDetails.schema";
import { DIFFICULTY_LEVELS, EXPERIENCE_LEVELS, GENDER_RESTRICTIONS } from "@/features/tours/models/tourTripDetails.schema";

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  none: "بدون پیش‌نیاز تجربه",
  basic: "مقدماتی",
  intermediate: "متوسط",
  advanced: "پیشرفته",
};

export const FITNESS_LEVEL_LABELS: Record<DifficultyLevel, string> = {
  easy: "سبک",
  moderate: "متوسط",
  hard: "سخت",
  technical: "فنی / تخصصی",
};

/** empty = ارسال نشود؛ none = بدون محدودیت صریح در API */
export const GENDER_RESTRICTION_LABELS: Record<GenderRestriction, string> = {
  none: "بدون محدودیت (همه)",
  male_only: "فقط آقایان",
  female_only: "فقط بانوان",
};

export function labelExperienceLevel(value: string | undefined): string | undefined {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  return (EXPERIENCE_LEVELS as readonly string[]).includes(v) ? EXPERIENCE_LEVEL_LABELS[v as ExperienceLevel] : v;
}

export function labelFitnessLevel(value: string | undefined): string | undefined {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  return (DIFFICULTY_LEVELS as readonly string[]).includes(v) ? FITNESS_LEVEL_LABELS[v as DifficultyLevel] : v;
}

export function labelGenderRestriction(value: string | undefined): string | undefined {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  return (GENDER_RESTRICTIONS as readonly string[]).includes(v) ? GENDER_RESTRICTION_LABELS[v as GenderRestriction] : v;
}
