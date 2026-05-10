import type { CreateTourDto } from "@/lib/services/tours.service";
import type { ExperienceLevel, DifficultyLevel, TripStyle, GenderRestriction } from "@/features/tours/models/tourTripDetails.schema";
import {
  EXPERIENCE_LEVELS,
  DIFFICULTY_LEVELS,
  TRIP_STYLES,
  GENDER_RESTRICTIONS,
} from "@/features/tours/models/tourTripDetails.schema";
import { normalizeAudienceGroups, type AudienceGroup } from "@/features/tours/domain/audience-groups";

export const TOUR_TYPES = ["mountain", "city", "desert", "nature", "cultural"] as const;
export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
export const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function trimToUndefined(value: string | null | undefined): string | undefined {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : undefined;
}

export function dedupeStringList(values: string[] | undefined): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const out = [...new Set(values.map((v) => v.trim()).filter((v) => v.length > 0))];
  return out.length > 0 ? out : undefined;
}

export function splitLinesToList(value: string | undefined): string[] | undefined {
  return dedupeStringList((value ?? "").split("\n"));
}

export function csvOrNewlineToList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return dedupeStringList(value.split(/[\n,]+/g));
}

export function deriveShortDescription(shortDescription?: string, longDescription?: string): string | undefined {
  const shortText = trimToUndefined(shortDescription);
  if (shortText) return shortText;
  const longText = trimToUndefined(longDescription);
  if (!longText) return undefined;
  return longText.slice(0, 160).trim();
}

export function clampDurationToApiRange(days: number | undefined): number | undefined {
  if (days == null || !Number.isInteger(days)) return undefined;
  if (days < 1 || days > 60) return undefined;
  return days;
}

export function computeDurationDays(startDate?: string, endDate?: string): number | undefined {
  const start = trimToUndefined(startDate);
  const end = trimToUndefined(endDate);
  if (!start || !end || !YMD_RE.test(start) || !YMD_RE.test(end)) return undefined;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return undefined;
  return clampDurationToApiRange(Math.round((endMs - startMs) / 86_400_000) + 1);
}

export function toTourType(value: string | undefined): CreateTourDto["tourType"] | undefined {
  if (!value) return undefined;
  return (TOUR_TYPES as readonly string[]).includes(value) ? (value as CreateTourDto["tourType"]) : undefined;
}

export function toExperienceLevel(value: string | undefined): ExperienceLevel | undefined {
  if (!value) return undefined;
  return (EXPERIENCE_LEVELS as readonly string[]).includes(value) ? (value as ExperienceLevel) : undefined;
}

export function toFitnessLevel(value: string | undefined): DifficultyLevel | undefined {
  if (!value) return undefined;
  return (DIFFICULTY_LEVELS as readonly string[]).includes(value) ? (value as DifficultyLevel) : undefined;
}

export function toTripStyles(values: string[] | undefined): TripStyle[] | undefined {
  const cleaned = dedupeStringList(values);
  if (!cleaned) return undefined;
  const allowed = cleaned.filter((v): v is TripStyle => (TRIP_STYLES as readonly string[]).includes(v));
  return allowed.length > 0 ? allowed : undefined;
}

export function toUuidList(values: string[] | undefined): string[] | undefined {
  const cleaned = dedupeStringList(values);
  if (!cleaned) return undefined;
  const uuids = cleaned.filter((v) => UUID_V4_RE.test(v));
  return uuids.length > 0 ? uuids : undefined;
}

export function toGenderRestriction(value: string | undefined): GenderRestriction | undefined {
  const t = trimToUndefined(value);
  if (!t) return undefined;
  return (GENDER_RESTRICTIONS as readonly string[]).includes(t) ? (t as GenderRestriction) : undefined;
}

export function toAudienceGroups(values: string[] | undefined): AudienceGroup[] | undefined {
  if (!values?.length) return undefined;
  const n = normalizeAudienceGroups(values);
  return n.length > 0 ? n : undefined;
}

export function overviewTourThemeIdsFromWizard(
  mainTourThemeId: string | undefined,
  secondaryTourThemeIds: string[] | undefined,
): string[] | undefined {
  const main = trimToUndefined(mainTourThemeId);
  const mainOk = main && UUID_V4_RE.test(main) ? main : undefined;
  const secRaw = Array.isArray(secondaryTourThemeIds) ? secondaryTourThemeIds : [];
  const secOk = [...new Set(secRaw.filter((id) => UUID_V4_RE.test(id)).filter((id) => id !== mainOk))];
  const ordered = mainOk ? [mainOk, ...secOk] : secOk;
  return ordered.length > 0 ? ordered : undefined;
}
