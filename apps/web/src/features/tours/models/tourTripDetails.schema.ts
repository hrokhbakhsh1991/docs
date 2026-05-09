import { z } from "zod";
import type { TripDetailsFieldConfig, TripDetailsFieldId } from "../config/tripDetailsFieldConfig";

/** Aligned with API `TRIP_STYLE_VALUES` / `TripDetailsOverviewDto.tripStyle`. */
export const TRIP_STYLES = [
  "mountaineering",
  "nature",
  "cultural",
  "city",
  "desert",
  "adventure",
  "mixed",
] as const;
export type TripStyle = (typeof TRIP_STYLES)[number];

/** Aligned with Nest `DifficultyLevel` / overview + participation. */
export const DIFFICULTY_LEVELS = ["easy", "moderate", "hard", "technical"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const GENDER_RESTRICTIONS = ["none", "male_only", "female_only"] as const;
export type GenderRestriction = (typeof GENDER_RESTRICTIONS)[number];

export const EXPERIENCE_LEVELS = ["none", "basic", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

function emptyToUndefined(raw: unknown): unknown {
  if (raw === "" || raw === null || raw === undefined) {
    return undefined;
  }
  return raw;
}

/** Optional integer inputs (cleared number fields → omit). */
function optionalIntInRange(min: number, max: number) {
  return z.preprocess(
    emptyToUndefined,
    z.union([
      z.undefined(),
      z.coerce
        .number()
        .int()
        .min(min, `Must be between ${min} and ${max}.`)
        .max(max, `Must be between ${min} and ${max}.`),
    ]),
  );
}

function requiredIntInRange(min: number, max: number, message: string) {
  return z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ message })
      .int()
      .min(min, `Must be between ${min} and ${max}.`)
      .max(max, `Must be between ${min} and ${max}.`),
  );
}

const optionalLongText = z
  .string()
  .max(10_000)
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v.trim()));

const optionalShortText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? undefined : v.trim()));

const optionalStringList = z.array(z.string().max(500).trim()).optional();
const requiredStringList = (message: string) => z.array(z.string().max(500).trim()).min(1, message);
const requiredShortText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .max(max);

const TripDetailsDayPlanSchema = z.object({
  day: z.coerce.number().int().min(1, "Day must be at least 1."),
  title: optionalShortText(500),
  description: optionalLongText,
  distanceKm: optionalIntInRange(0, 50_000),
  elevationGainM: optionalIntInRange(-10_000, 30_000),
});

const TripDetailsOverviewSchema = z
  .object({
    mainDestination: optionalShortText(500),
    destinationRegion: optionalShortText(500),
    tourTheme: optionalStringList,
    tripStyle: z.enum(TRIP_STYLES).optional(),
    difficultyLevel: z.enum(DIFFICULTY_LEVELS).optional(),
    elevationGainMeters: optionalIntInRange(0, 30_000),
    maxAltitudeMeters: optionalIntInRange(-500, 30_000),
    bestFor: optionalStringList,
    shortIntro: optionalLongText,
  })
  .strip();

const TripDetailsItinerarySchema = z
  .object({
    highlights: optionalStringList,
    includedVisits: optionalStringList,
    excludedVisits: optionalStringList,
    optionalActivities: optionalStringList,
    outline: optionalLongText,
    programNotes: optionalLongText,
    specialExperiences: optionalStringList,
    dayPlans: z.array(TripDetailsDayPlanSchema).optional(),
  })
  .strip();

const TripDetailsParticipationSchema = z
  .object({
    minimumAge: optionalIntInRange(0, 150),
    maximumAge: optionalIntInRange(0, 150),
    genderRestriction: z.enum(GENDER_RESTRICTIONS).optional(),
    fitnessLevel: z.enum(DIFFICULTY_LEVELS).optional(),
    experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
    medicalRestrictions: optionalLongText,
    technicalSkillRequired: optionalShortText(512),
    requirements: optionalLongText,
    skillsRequired: optionalStringList,
    gearRequired: optionalStringList,
    gearOptional: optionalStringList,
    documentsRequired: optionalStringList,
    suitableFor: optionalStringList,
    notSuitableFor: optionalStringList,
  })
  .strip();

const TripDetailsLogisticsSchema = z
  .object({
    meetingPoint: optionalShortText(2048),
    departureMeetingTime: optionalShortText(128),
    departureDate: optionalShortText(32),
    returnDate: optionalShortText(32),
    returnPoint: optionalShortText(2048),
    transportation: optionalShortText(1000),
    accommodationType: optionalShortText(500),
    mealPlan: optionalShortText(1000),
    supportServices: optionalStringList,
    includedServices: optionalStringList,
    excludedServices: optionalStringList,
    optionalServices: optionalStringList,
    guideLanguage: optionalStringList,
    groupSizeMin: optionalIntInRange(0, 10_000),
    groupSizeMax: optionalIntInRange(0, 10_000),
  })
  .strip();

const TripDetailsPoliciesSchema = z
  .object({
    reservationRules: optionalLongText,
    cancellationPolicy: optionalLongText,
    refundPolicy: optionalLongText,
    attendanceRules: optionalLongText,
    lateArrivalPolicy: optionalLongText,
    noShowPolicy: optionalLongText,
    confirmationPolicy: optionalLongText,
    capacityPolicy: optionalLongText,
    weatherPolicy: optionalLongText,
    safetyPolicy: optionalLongText,
  })
  .strip();

/**
 * Structured trip details for create (and future edit) flows.
 * Matches backend `TourTripDetails` / `trip_details` JSONB shape (camelCase).
 */
export const TourTripDetailsSchema = z
  .object({
    schemaVersion: optionalIntInRange(1, 99),
    overview: TripDetailsOverviewSchema.optional(),
    itinerary: TripDetailsItinerarySchema.optional(),
    participation: TripDetailsParticipationSchema.optional(),
    logistics: TripDetailsLogisticsSchema.optional(),
    policies: TripDetailsPoliciesSchema.optional(),
  })
  .strip();

export type TourTripDetails = z.infer<typeof TourTripDetailsSchema>;

/** Root `tripDetails` on create: omit, `undefined`, or a validated structured object. */
export const TourTripDetailsRootSchema = TourTripDetailsSchema.optional();

/**
 * Applies requiredness constraints from field-config on top of base optional trip-details schema.
 * The config remains source-of-truth; unknown/unsupported field IDs are ignored safely.
 */
export function applyTripDetailsRequirednessToSchema(
  baseSchema: typeof TourTripDetailsRootSchema,
  fieldConfig: TripDetailsFieldConfig[],
): typeof TourTripDetailsRootSchema {
  const requiredIds = new Set<TripDetailsFieldId>(
    fieldConfig.filter((row) => row.requiredness === "required" && row.visibility !== "hidden").map((row) => row.id),
  );
  if (requiredIds.size === 0) return baseSchema;

  const overviewSchema = TripDetailsOverviewSchema.extend({
    difficultyLevel: requiredIds.has("overview.difficultyLevel")
      ? z.enum(DIFFICULTY_LEVELS, { message: "Difficulty level is required for this event kind." })
      : TripDetailsOverviewSchema.shape.difficultyLevel,
  });
  const participationSchema = TripDetailsParticipationSchema.extend({
    minimumAge: requiredIds.has("participation.minimumAge")
      ? requiredIntInRange(0, 150, "Minimum age is required for this event kind.")
      : TripDetailsParticipationSchema.shape.minimumAge,
    gearRequired: requiredIds.has("participation.gearRequired")
      ? requiredStringList("At least one required gear item is needed for this event kind.")
      : TripDetailsParticipationSchema.shape.gearRequired,
  });
  const logisticsSchema = TripDetailsLogisticsSchema.extend({
    meetingPoint: requiredIds.has("logistics.meetingPoint")
      ? requiredShortText(2048, "Meeting point is required for this event kind.")
      : TripDetailsLogisticsSchema.shape.meetingPoint,
    departureDate: requiredIds.has("logistics.departureDate")
      ? requiredShortText(32, "Departure date is required for this event kind.")
      : TripDetailsLogisticsSchema.shape.departureDate,
  });

  const hasRequiredInOverview = [...requiredIds].some((id) => id.startsWith("overview."));
  const hasRequiredInParticipation = [...requiredIds].some((id) => id.startsWith("participation."));
  const hasRequiredInLogistics = [...requiredIds].some((id) => id.startsWith("logistics."));
  const requiredSection = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((value) => value ?? {}, schema);

  return TourTripDetailsSchema.extend({
    overview: hasRequiredInOverview ? requiredSection(overviewSchema) : overviewSchema.optional(),
    participation: hasRequiredInParticipation ? requiredSection(participationSchema) : participationSchema.optional(),
    logistics: hasRequiredInLogistics ? requiredSection(logisticsSchema) : logisticsSchema.optional(),
  }).optional() as typeof TourTripDetailsRootSchema;
}

/**
 * Builds stable RHF defaults for `tripDetails` from API `details.tripDetails` (often `Record<string, unknown>`).
 * Ensures `itinerary.dayPlans` is always an array for `useFieldArray`.
 */
export function normalizeTripDetailsFormDefault(
  raw: Record<string, unknown> | TourTripDetails | null | undefined
): TourTripDetails {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { itinerary: { dayPlans: [] } } as unknown as TourTripDetails;
  }
  const o = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  const itinRaw = o.itinerary;
  const itin =
    typeof itinRaw === "object" && itinRaw !== null && !Array.isArray(itinRaw)
      ? (itinRaw as Record<string, unknown>)
      : {};
  const dayPlans = Array.isArray(itin.dayPlans) ? itin.dayPlans : [];
  return { ...o, itinerary: { ...itin, dayPlans } } as TourTripDetails;
}

function trimToUndefined(s: string): string | undefined {
  const t = s.trim();
  return t === "" ? undefined : t;
}

function finiteNumberOrUndefined(n: unknown): number | undefined {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : undefined;
}

/**
 * Serialize `tripDetails` for `POST /api/v2/tours` (camelCase JSON, matches Nest `TourTripDetailsDto`).
 * - Drops `undefined`, empty strings, non-finite numbers, and empty `{}` / `[]` subtrees.
 * - Trims string values; string arrays keep only non-empty trimmed entries.
 * - `dayPlans`: keeps rows with integer `day` ≥ 1; omits blank optional fields per row.
 * - Final `JSON.parse(JSON.stringify)` guarantees no `undefined` leaks into axios JSON.
 */
export function compactTripDetailsForApi(value: TourTripDetails | undefined): Record<string, unknown> | undefined {
  if (value == null || typeof value !== "object") {
    return undefined;
  }

  function walkDayPlanRow(row: unknown): Record<string, unknown> | undefined {
    if (row == null || typeof row !== "object" || Array.isArray(row)) {
      return undefined;
    }
    const o = row as Record<string, unknown>;
    const day = finiteNumberOrUndefined(o.day);
    if (day === undefined || !Number.isInteger(day) || day < 1) {
      return undefined;
    }
    const out: Record<string, unknown> = { day };
    if (typeof o.title === "string") {
      const t = trimToUndefined(o.title);
      if (t !== undefined) {
        out.title = t;
      }
    }
    if (typeof o.description === "string") {
      const t = trimToUndefined(o.description);
      if (t !== undefined) {
        out.description = t;
      }
    }
    const distanceKm = finiteNumberOrUndefined(o.distanceKm);
    if (distanceKm !== undefined && Number.isInteger(distanceKm) && distanceKm >= 0) {
      out.distanceKm = distanceKm;
    }
    const elevationGainM = finiteNumberOrUndefined(o.elevationGainM);
    if (elevationGainM !== undefined && Number.isInteger(elevationGainM)) {
      out.elevationGainM = elevationGainM;
    }
    return out;
  }

  function walk(input: unknown, key?: string): unknown {
    if (input === undefined) {
      return undefined;
    }
    if (input === null) {
      return null;
    }
    if (typeof input === "string") {
      return trimToUndefined(input);
    }
    if (typeof input === "number") {
      return Number.isFinite(input) ? input : undefined;
    }
    if (Array.isArray(input)) {
      if (key === "dayPlans") {
        const rows = (input as unknown[])
          .map((row) => walkDayPlanRow(row))
          .filter((r): r is Record<string, unknown> => r != null && Object.keys(r).length > 0);
        return rows.length > 0 ? rows : undefined;
      }
      const primitives = (input as unknown[]).map((item) => walk(item, undefined));
      const filtered = primitives.filter(
        (x) => x !== undefined && x !== "" && !(typeof x === "number" && !Number.isFinite(x)),
      );
      return filtered.length > 0 ? filtered : undefined;
    }
    if (typeof input === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        const next = walk(v, k);
        if (next === undefined || next === null) {
          continue;
        }
        if (Array.isArray(next) && next.length === 0) {
          continue;
        }
        if (typeof next === "object" && next !== null && !Array.isArray(next)) {
          const nk = Object.keys(next as Record<string, unknown>).length;
          if (nk === 0) {
            continue;
          }
        }
        out[k] = next;
      }
      return Object.keys(out).length > 0 ? out : undefined;
    }
    return input;
  }

  const compacted = walk(value) as Record<string, unknown> | undefined;
  if (compacted == null || Object.keys(compacted).length === 0) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(compacted)) as Record<string, unknown>;
}
