import { z } from "zod";

import {
  ACCOMMODATION_TYPE_VALUES,
  MEAL_PLAN_VALUES,
  normalizeLegacyOverviewTripStyleToTripStyles,
  parseLegacyAccommodationTypeString,
  parseLegacyMealPlanString,
  type AccommodationTypeSlug,
  type MealPlanSlug
} from "@repo/types";

import { normalizeNumericInput } from "@/lib/digit-localization";
import {
  AUDIENCE_GROUP_VALUES,
  findAudienceOverlap,
  normalizeAudienceGroups,
  type AudienceGroup,
} from "../domain/audience-groups";
import {
  DIFFICULTY_RATING_MAX,
  DIFFICULTY_RATING_MIN,
  isValidDifficultyRating,
} from "../domain/difficulty-rating";
import type { TripDetailsFieldConfig, TripDetailsFieldId } from "../config/tripDetailsFieldConfig";
import {
  DEFAULT_TOURS_NEW_VALIDATION_MESSAGES,
  type ToursNewValidationMessages,
} from "./tours-new-validation-messages";

/** Max length for `tripDetails.overview.shortIntro` (cards / previews); keep in sync with API `TRIP_SHORT_INTRO_MAX_LENGTH`. */
export const TRIP_SHORT_INTRO_MAX_LENGTH = 250;

/**
 * Sub-genre / **execution style** — orthogonal to top-level `TOUR_TYPES`
 * (the category). Multi-select. Aligned with API `TRIP_STYLE_VALUES`.
 *
 * The legacy singular overview style value `"relax"` was renamed to `relaxed` in `tripStyles[]`.
 * Legacy category-like values (`mountaineering`, `nature`, `cultural`, `city`,
 * `desert`, `mixed`) are intentionally not part of the new picker; the
 * tour-kind resolver still honors them when reading old JSONB documents.
 */
export const TRIP_STYLES = [
  "adventure",
  "relaxed",
  "luxury",
  "budget",
  "familyFriendly",
  "photography",
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

function englishDigitsUnknown(raw: unknown): unknown {
  if (typeof raw === "string") {
    return normalizeNumericInput(raw.replace(/\u066b/g, "."));
  }
  return raw;
}

/** v4 UUID string filter for JSONB id arrays (`gear*Ids`, `tourThemeIds`, …). */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function filterUuidV4Strings(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") {
      continue;
    }
    const t = x.trim();
    if (!UUID_V4_RE.test(t) || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out;
}

function tripDetailsAudienceOverlapRefinement(
  value: unknown,
  ctx: z.RefinementCtx,
  messages: ToursNewValidationMessages,
): void {
  const v = value as {
    participation?: { suitableFor?: AudienceGroup[]; notSuitableFor?: AudienceGroup[] };
  };
  const p = v.participation;
  if (!p) return;
  const overlap = findAudienceOverlap(p.suitableFor, p.notSuitableFor);
  if (overlap.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["participation", "notSuitableFor"],
      message: messages.audienceOverlap,
    });
  }
}

function buildTripDetailsSchemas(msgs: ToursNewValidationMessages) {
  function optionalIntInRange(min: number, max: number) {
    const rangeMsg = msgs.intBetween(min, max);
    return z.preprocess(
      (raw) => emptyToUndefined(englishDigitsUnknown(raw)),
      z.union([
        z.undefined(),
        z.coerce.number().int().min(min, rangeMsg).max(max, rangeMsg),
      ]),
    );
  }

  function optionalNumberInRange(min: number, max: number) {
    const rangeMsg = msgs.intBetween(min, max);
    return z.preprocess(
      (raw) => emptyToUndefined(englishDigitsUnknown(raw)),
      z.union([z.undefined(), z.coerce.number().min(min, rangeMsg).max(max, rangeMsg)]),
    );
  }

  function requiredIntInRange(min: number, max: number, coerceMessage: string) {
    const rangeMsg = msgs.intBetween(min, max);
    return z.preprocess(
      (raw) => emptyToUndefined(englishDigitsUnknown(raw)),
      z.coerce.number({ message: coerceMessage }).int().min(min, rangeMsg).max(max, rangeMsg),
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

  function dedupeTrimStringList(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const x of raw) {
      if (typeof x !== "string") {
        continue;
      }
      const t = x.trim();
      if (!t || seen.has(t)) {
        continue;
      }
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  const uuidGearItem = z.string().uuid({ message: msgs.gearIdEachInvalid });
  const uuidTourThemeItem = z.string().uuid({ message: msgs.tourThemeIdEachInvalid });

  const optionalGearUuidIdsList = z.preprocess((raw) => {
    const arr = dedupeTrimStringList(raw);
    return arr.length === 0 ? undefined : arr;
  }, z.array(uuidGearItem).optional());

  const optionalTourThemeUuidIdsList = z.preprocess((raw) => {
    const arr = dedupeTrimStringList(raw);
    return arr.length === 0 ? undefined : arr;
  }, z.array(uuidTourThemeItem).optional());

  const optionalTourThemeLabels = z
    .record(z.string().uuid({ message: msgs.tourThemeIdEachInvalid }), z.string().max(120))
    .optional();

  const requiredGearUuidIdsList = z.preprocess((raw) => {
    const arr = dedupeTrimStringList(raw);
    return arr.length === 0 ? [] : arr;
  }, z.array(uuidGearItem).min(1, msgs.gearRequiredMountain));
  const requiredShortText = (max: number, message: string) =>
    z
      .string()
      .trim()
      .min(1, message)
      .max(max);

  const TripDetailsDayPlanSchema = z.object({
    day: z.preprocess(englishDigitsUnknown, z.coerce.number().int().min(1, msgs.dayMinOne)),
    title: optionalShortText(500),
    description: optionalLongText,
    distanceKm: optionalIntInRange(0, 50_000),
    elevationGainM: optionalIntInRange(-10_000, 30_000),
  });

  const TripDetailsOverviewSchema = z
    .object({
      mainDestination: optionalShortText(500),
      destinationRegion: optionalShortText(500),
      tourThemeIds: optionalTourThemeUuidIdsList,
      tourThemeLabels: optionalTourThemeLabels,
      tripStyles: z
        .preprocess(
          (raw) => {
            if (raw === undefined || raw === null) return undefined;
            if (!Array.isArray(raw)) return raw;
            const seen = new Set<string>();
            const out: string[] = [];
            for (const entry of raw) {
              if (typeof entry !== "string") continue;
              const trimmed = entry.trim();
              if (trimmed === "" || seen.has(trimmed)) continue;
              seen.add(trimmed);
              out.push(trimmed);
            }
            return out.length > 0 ? out : undefined;
          },
          z.array(z.enum(TRIP_STYLES)).optional(),
        ),
      /**
       * Numeric `1..10` with `0.5` step. Legacy string values (`easy`,
       * `moderate`, `hard`, `technical`) coming from older JSONB documents
       * are silently ignored (left as `undefined`) so the form does not crash
       * when editing older tours.
       */
      difficultyLevel: z.preprocess(
        (raw) => {
          if (raw === undefined || raw === null || raw === "") return undefined;
          const normalized = englishDigitsUnknown(raw);
          if (typeof normalized === "string") {
            const n = Number(normalized);
            return Number.isFinite(n) ? n : undefined;
          }
          return normalized;
        },
        z.union([
          z.undefined(),
          z
            .number()
            .min(DIFFICULTY_RATING_MIN, msgs.difficultyRatingOutOfRange)
            .max(DIFFICULTY_RATING_MAX, msgs.difficultyRatingOutOfRange)
            .refine(isValidDifficultyRating, { message: msgs.difficultyRatingHalfStep }),
        ]),
      ),
      elevationGainMeters: optionalIntInRange(0, 30_000),
      maxAltitudeMeters: optionalIntInRange(-500, 30_000),
      shortIntro: optionalShortText(TRIP_SHORT_INTRO_MAX_LENGTH),
      /** Settings → Locations linkage (optional JSONB keys; ignored by older API readers). */
      settingsRegionId: optionalShortText(64),
      settingsMainDestinationId: optionalShortText(64),
      secondaryDestinationIdsRaw: optionalLongText,
    })
    .strip();

  const optionalTimeHhmm = z
    .string()
    .max(5)
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? undefined : v.trim()))
    .refine((v) => v === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), {
      message: msgs.timeFormatInvalid,
    });

  const TripDetailsItinerarySchema = z
    .object({
      segmentActivities: z
        .array(
          z
            .object({
              dayNumber: z.number().int().min(1),
              title: optionalShortText(256),
              description: optionalLongText,
              segments: z
                .array(
                  z
                    .object({
                      title: optionalShortText(256),
                      description: optionalLongText,
                      activityType: optionalShortText(64),
                      startTime: optionalTimeHhmm,
                      endTime: optionalTimeHhmm,
                      estimatedDurationHours: optionalNumberInRange(0, 240),
                      distanceKm: optionalNumberInRange(0, 10_000),
                      elevationGainMeters: optionalIntInRange(0, 30_000),
                      maxAltitudeMeters: optionalIntInRange(-500, 30_000),
                      locationName: optionalShortText(256),
                    })
                    .strip(),
                )
                .optional(),
            })
            .strip(),
        )
        .optional(),
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

  const audienceGroupArraySchema = z.preprocess(
    (raw) => {
      const n = normalizeAudienceGroups(raw);
      return n.length > 0 ? n : undefined;
    },
    z.array(z.enum(AUDIENCE_GROUP_VALUES)).optional(),
  );

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
      gearRequiredIds: optionalGearUuidIdsList,
      gearOptionalIds: optionalGearUuidIdsList,
      documentsRequired: optionalStringList,
      suitableFor: audienceGroupArraySchema,
      notSuitableFor: audienceGroupArraySchema,
      /** Participant must carry valid sport / mountaineering insurance (leader-enforced eligibility). */
      sportsInsuranceRequired: z.boolean().optional(),
      /** Profile national ID required at registration time (server-enforced). */
      registrationNationalIdRequired: z.boolean().optional(),
    })
    .strip();

  const TripDetailsLogisticsSchema = z
    .object({
      primaryTransportMode: z.enum(["plane", "train", "bus", "midibus", "private_car"]).optional(),
      fuelShareToman: optionalIntInRange(0, 10_000_000_000),
      meetingPoint: optionalShortText(2048),
      departureMeetingTime: optionalTimeHhmm,
      returnMeetingTime: optionalTimeHhmm,
      departureDate: optionalShortText(32),
      returnDate: optionalShortText(32),
      returnPoint: optionalShortText(2048),
      transportationNotes: optionalShortText(1000),
      /** @deprecated Legacy key — merged into `transportationNotes` in `normalizeTripDetailsFormDefault`. */
      transportation: optionalShortText(1000),
      accommodationTypes: z
        .array(z.enum(ACCOMMODATION_TYPE_VALUES as unknown as [string, ...string[]]))
        .optional(),
      accommodationNotes: optionalShortText(500),
      /** @deprecated Legacy free-text — merged in `normalizeTripDetailsFormDefault`. */
      accommodationType: optionalShortText(500),
      mealPlan: z.preprocess(
        (v) => (v === "" ? undefined : v),
        z.enum(MEAL_PLAN_VALUES as unknown as [string, ...string[]]).optional(),
      ),
      mealNotes: optionalShortText(500),
      supportServices: optionalStringList,
      includedServices: optionalStringList,
      excludedServices: optionalStringList,
      optionalServices: optionalStringList,
      /** Organizer includes some insurance coverage in the tour package (distinct from participant sport insurance). */
      leaderProvidesInsurance: z.boolean().optional(),
      /** Short note when `leaderProvidesInsurance` (scope, insurer type, exclusions). */
      leaderInsuranceNotes: optionalShortText(500),
      guideLanguageIds: optionalGearUuidIdsList,
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

  const TourTripDetailsBaseSchema = z
    .object({
      /**
       * Internal management field used for forward-compatible JSONB shape upgrades
       * (set by migrations/admin tooling). Intentionally **not** rendered in the
       * tour creation form — leaders should never see or edit it.
       */
      schemaVersion: optionalIntInRange(1, 99),
      overview: TripDetailsOverviewSchema.optional(),
      itinerary: TripDetailsItinerarySchema.optional(),
      participation: TripDetailsParticipationSchema.optional(),
      logistics: TripDetailsLogisticsSchema.optional(),
      policies: TripDetailsPoliciesSchema.optional(),
    })
    .strip();

  const TourTripDetailsSchema = TourTripDetailsBaseSchema.superRefine((value, ctx) => {
    tripDetailsAudienceOverlapRefinement(value, ctx, msgs);
  });

  const TourTripDetailsRootSchema = TourTripDetailsSchema.optional();

  return {
    TripDetailsOverviewSchema,
    TripDetailsParticipationSchema,
    TripDetailsLogisticsSchema,
    TourTripDetailsBaseSchema,
    TourTripDetailsSchema,
    TourTripDetailsRootSchema,
    requiredIntInRange,
    requiredStringList,
    requiredShortText,
    requiredGearUuidIdsList,
  };
}

const _defaultTripDetails = buildTripDetailsSchemas(DEFAULT_TOURS_NEW_VALIDATION_MESSAGES);

export const TourTripDetailsSchema = _defaultTripDetails.TourTripDetailsSchema;
export const TourTripDetailsRootSchema = _defaultTripDetails.TourTripDetailsRootSchema;

export type TourTripDetails = z.infer<typeof TourTripDetailsSchema>;

/**
 * Applies requiredness constraints from field-config on top of base optional trip-details schema.
 * The config remains source-of-truth; unknown/unsupported field IDs are ignored safely.
 */
export function applyTripDetailsRequirednessToSchema(
  fieldConfig: TripDetailsFieldConfig[],
  messages: ToursNewValidationMessages = DEFAULT_TOURS_NEW_VALIDATION_MESSAGES,
): typeof TourTripDetailsRootSchema {
  const {
    TripDetailsOverviewSchema,
    TripDetailsParticipationSchema,
    TripDetailsLogisticsSchema,
    TourTripDetailsBaseSchema,
    requiredIntInRange: reqInt,
    requiredShortText: reqShort,
    requiredGearUuidIdsList: reqGearUuidIdsList,
  } = buildTripDetailsSchemas(messages);

  const requiredIds = new Set<TripDetailsFieldId>(
    fieldConfig.filter((row) => row.requiredness === "required" && row.visibility !== "hidden").map((row) => row.id),
  );

  const overviewSchema = TripDetailsOverviewSchema.extend({
    difficultyLevel: requiredIds.has("overview.difficultyLevel")
      ? z.preprocess(
          (raw) => {
            if (raw === undefined || raw === null || raw === "") return raw;
            if (typeof raw === "string") {
              const n = Number(normalizeNumericInput(raw));
              return Number.isFinite(n) ? n : raw;
            }
            return raw;
          },
          z
            .number({ message: messages.difficultyRequiredMountain })
            .min(DIFFICULTY_RATING_MIN, messages.difficultyRatingOutOfRange)
            .max(DIFFICULTY_RATING_MAX, messages.difficultyRatingOutOfRange)
            .refine(isValidDifficultyRating, { message: messages.difficultyRatingHalfStep }),
        )
      : TripDetailsOverviewSchema.shape.difficultyLevel,
  });
  const participationSchema = TripDetailsParticipationSchema.extend({
    minimumAge: requiredIds.has("participation.minimumAge")
      ? reqInt(0, 150, messages.minimumAgeRequiredMountain)
      : TripDetailsParticipationSchema.shape.minimumAge,
    gearRequiredIds: requiredIds.has("participation.gearRequiredIds")
      ? reqGearUuidIdsList
      : TripDetailsParticipationSchema.shape.gearRequiredIds,
  });
  const logisticsSchema = TripDetailsLogisticsSchema.extend({
    meetingPoint: requiredIds.has("logistics.meetingPoint")
      ? reqShort(2048, messages.meetingPointRequiredMountain)
      : TripDetailsLogisticsSchema.shape.meetingPoint,
    departureDate: requiredIds.has("logistics.departureDate")
      ? reqShort(32, messages.departureDateRequiredMountain)
      : TripDetailsLogisticsSchema.shape.departureDate,
  });

  const hasRequiredInOverview = [...requiredIds].some((id) => id.startsWith("overview."));
  const hasRequiredInParticipation = [...requiredIds].some((id) => id.startsWith("participation."));
  const hasRequiredInLogistics = [...requiredIds].some((id) => id.startsWith("logistics."));
  const requiredSection = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((value) => value ?? {}, schema);

  const composed =
    requiredIds.size === 0
      ? TourTripDetailsBaseSchema
      : TourTripDetailsBaseSchema.extend({
          overview: hasRequiredInOverview ? requiredSection(overviewSchema) : overviewSchema.optional(),
          participation: hasRequiredInParticipation
            ? requiredSection(participationSchema)
            : participationSchema.optional(),
          logistics: hasRequiredInLogistics ? requiredSection(logisticsSchema) : logisticsSchema.optional(),
        });

  return composed
    .superRefine((value, ctx) => {
      tripDetailsAudienceOverlapRefinement(value, ctx, messages);
    })
    .superRefine((value, ctx) => {
      const logistics = (value as { logistics?: { departureDate?: unknown; returnDate?: unknown } } | undefined)
        ?.logistics;
      if (!logistics) return;
      const dep = typeof logistics.departureDate === "string" ? logistics.departureDate.trim() : "";
      const ret = typeof logistics.returnDate === "string" ? logistics.returnDate.trim() : "";
      const today = todayGregorianYmd();
      if (dep && dep < today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["logistics", "departureDate"],
          message: messages.departureDateNotPast,
        });
      }
      if (ret && ret < today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["logistics", "returnDate"],
          message: messages.returnDateNotPast,
        });
      }
      if (dep && ret && ret < dep) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["logistics", "returnDate"],
          message: messages.returnDateBeforeDeparture,
        });
      }
    })
    .optional() as typeof TourTripDetailsRootSchema;
}

/** Local-time Gregorian YMD; matches the picker's local "today" so timezone drift doesn't false-flag. */
function todayGregorianYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Builds stable RHF defaults for `tripDetails` from API `details.tripDetails` (often `Record<string, unknown>`).
 * Ensures `itinerary.dayPlans` is always an array for `useFieldArray`.
 */
export function normalizeTripDetailsFormDefault(
  raw: Record<string, unknown> | TourTripDetails | null | undefined,
): TourTripDetails {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { itinerary: { dayPlans: [] } } as unknown as TourTripDetails;
  }
  const o = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  normalizeLegacyOverviewTripStyleToTripStyles(o);
  const itinRaw = o.itinerary;
  const itin =
    typeof itinRaw === "object" && itinRaw !== null && !Array.isArray(itinRaw)
      ? (itinRaw as Record<string, unknown>)
      : {};
  const dayPlans = Array.isArray(itin.dayPlans) ? itin.dayPlans : [];
  const overviewRaw = o.overview;
  if (overviewRaw && typeof overviewRaw === "object" && !Array.isArray(overviewRaw)) {
    const ov = overviewRaw as Record<string, unknown>;
    delete ov.bestFor;
    delete ov.tourTheme;
    if ("tourThemeIds" in ov) {
      const next = filterUuidV4Strings(ov.tourThemeIds);
      if (next.length > 0) {
        ov.tourThemeIds = next;
      } else {
        delete ov.tourThemeIds;
      }
    }
    if ("tourThemeLabels" in ov && ov.tourThemeLabels != null && typeof ov.tourThemeLabels === "object") {
      const rawLabels = ov.tourThemeLabels as Record<string, unknown>;
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawLabels)) {
        const kid = k.trim();
        if (!UUID_V4_RE.test(kid) || typeof v !== "string") {
          continue;
        }
        const t = v.trim().slice(0, 120);
        if (t) {
          cleaned[kid] = t;
        }
      }
      if (Object.keys(cleaned).length > 0) {
        ov.tourThemeLabels = cleaned;
      } else {
        delete ov.tourThemeLabels;
      }
    }
  }
  const partRaw = o.participation;
  if (partRaw && typeof partRaw === "object" && !Array.isArray(partRaw)) {
    const p = partRaw as Record<string, unknown>;
    if ("suitableFor" in p) {
      const n = normalizeAudienceGroups(p.suitableFor);
      if (n.length > 0) {
        p.suitableFor = n;
      } else {
        delete p.suitableFor;
      }
    }
    if ("notSuitableFor" in p) {
      const n = normalizeAudienceGroups(p.notSuitableFor);
      if (n.length > 0) {
        p.notSuitableFor = n;
      } else {
        delete p.notSuitableFor;
      }
    }
    if ("gearRequiredIds" in p) {
      const next = filterUuidV4Strings(p.gearRequiredIds);
      if (next.length > 0) {
        p.gearRequiredIds = next;
      } else {
        delete p.gearRequiredIds;
      }
    }
    if ("gearOptionalIds" in p) {
      const next = filterUuidV4Strings(p.gearOptionalIds);
      if (next.length > 0) {
        p.gearOptionalIds = next;
      } else {
        delete p.gearOptionalIds;
      }
    }
    delete p.gearRequired;
    delete p.gearOptional;
  }
  const logRaw = o.logistics;
  if (logRaw && typeof logRaw === "object" && !Array.isArray(logRaw)) {
    const lg = logRaw as Record<string, unknown>;
    const notes =
      typeof lg.transportationNotes === "string" ? String(lg.transportationNotes).trim() : "";
    const legacy =
      typeof lg.transportation === "string" ? String(lg.transportation).trim() : "";
    if (!notes && legacy) {
      lg.transportationNotes = legacy;
    }
    delete lg.transportation;

    const rawAccTypes = lg.accommodationTypes;
    let accTypes: string[] = [];
    if (Array.isArray(rawAccTypes)) {
      for (const x of rawAccTypes) {
        if (typeof x !== "string") {
          continue;
        }
        const s = x.trim().toLowerCase().replace(/\s+/g, "_");
        if ((ACCOMMODATION_TYPE_VALUES as readonly string[]).includes(s)) {
          accTypes.push(s);
        }
      }
      accTypes = [...new Set(accTypes)].sort((a, b) => a.localeCompare(b));
    }
    const legacyAcc =
      typeof lg.accommodationType === "string" ? String(lg.accommodationType).trim() : "";
    let accNotes =
      typeof lg.accommodationNotes === "string" ? String(lg.accommodationNotes).trim() : "";

    if (accTypes.length === 0 && legacyAcc) {
      const { types, remainder } = parseLegacyAccommodationTypeString(legacyAcc);
      accTypes = types as string[];
      if (remainder) {
        accNotes = accNotes ? `${accNotes}\n${remainder}` : remainder;
      }
    }

    if (accTypes.length > 0) {
      lg.accommodationTypes = accTypes as AccommodationTypeSlug[];
    } else {
      delete lg.accommodationTypes;
    }
    if (accNotes) {
      lg.accommodationNotes = accNotes;
    } else {
      delete lg.accommodationNotes;
    }
    delete lg.accommodationType;

    const rawMeal = lg.mealPlan;
    let mealNotesStr =
      typeof lg.mealNotes === "string" ? String(lg.mealNotes).trim() : "";
    let mealSlug: MealPlanSlug | undefined;

    if (typeof rawMeal === "string") {
      const v = rawMeal.trim().toLowerCase().replace(/\s+/g, "_");
      if ((MEAL_PLAN_VALUES as readonly string[]).includes(v)) {
        mealSlug = v as MealPlanSlug;
      } else if (rawMeal.trim()) {
        const { plan, remainder } = parseLegacyMealPlanString(rawMeal);
        if (plan) {
          mealSlug = plan;
        }
        if (remainder) {
          mealNotesStr = mealNotesStr ? `${mealNotesStr}\n${remainder}` : remainder;
        }
      }
    }

    if (mealSlug) {
      lg.mealPlan = mealSlug;
    } else {
      delete lg.mealPlan;
    }
    if (mealNotesStr) {
      lg.mealNotes = mealNotesStr;
    } else {
      delete lg.mealNotes;
    }

    const rawGuideIds = lg.guideLanguageIds;
    if (Array.isArray(rawGuideIds)) {
      const next = filterUuidV4Strings(rawGuideIds);
      if (next.length > 0) {
        lg.guideLanguageIds = next;
      } else {
        delete lg.guideLanguageIds;
      }
    }
    delete lg.guideLanguage;
  }
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
  const root = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  const part = root.participation;
  if (part != null && typeof part === "object" && !Array.isArray(part)) {
    delete (part as Record<string, unknown>).gearRequired;
    delete (part as Record<string, unknown>).gearOptional;
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
        if (k === "bestFor") {
          continue;
        }
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

  const compacted = walk(root) as Record<string, unknown> | undefined;
  if (compacted == null || Object.keys(compacted).length === 0) {
    return undefined;
  }
  const logistics = compacted.logistics;
  if (logistics && typeof logistics === "object" && !Array.isArray(logistics)) {
    const lg = logistics as Record<string, unknown>;
    const notes =
      typeof lg.transportationNotes === "string" ? String(lg.transportationNotes).trim() : "";
    if (notes.length > 0) {
      lg.transportation = notes;
    }
    const accTypesRaw = lg.accommodationTypes;
    if (Array.isArray(accTypesRaw) && accTypesRaw.length > 0) {
      lg.accommodationType = (accTypesRaw as string[]).join(", ");
    }
  }
  return JSON.parse(JSON.stringify(compacted)) as Record<string, unknown>;
}
