import {
  ACCOMMODATION_TYPE_VALUES,
  MEAL_PLAN_VALUES,
  parseLegacyAccommodationTypeString,
  parseLegacyMealPlanString,
  type AccommodationTypeSlug,
  type MealPlanSlug,
} from "@repo/types";

import { filterUuidV4Strings } from "./wire-primitives";
import { tourTripDetailsWireSchema, type TourTripDetailsWire } from "./tour-trip-details-wire.schema";

function trimToUndefined(s: string): string | undefined {
  const t = s.trim();
  return t === "" ? undefined : t;
}

function walkPhotoRow(row: unknown): Record<string, unknown> | undefined {
  if (row == null || typeof row !== "object" || Array.isArray(row)) {
    return undefined;
  }
  const o = row as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const filename = typeof o.filename === "string" ? o.filename.trim() : "";
  const mimeType = typeof o.mimeType === "string" ? o.mimeType.trim() : "";
  const uploadedAt = typeof o.uploadedAt === "string" ? o.uploadedAt.trim() : "";
  const size = finiteNumberOrUndefined(o.size);
  if (!id || !filename || !mimeType || !uploadedAt || size === undefined || !Number.isInteger(size) || size < 0) {
    return undefined;
  }
  return { id, filename, mimeType, uploadedAt, size };
}

function stripEphemeralPhotoUrl(row: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!row) {
    return undefined;
  }
  const { url: _url, ...rest } = row;
  return rest;
}

function finiteNumberOrUndefined(n: unknown): number | undefined {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : undefined;
}

/**
 * Canonical egress normalizer for `tripDetails` on `POST /api/v2/tours`.
 * Shared by web mappers and API ingress validation — no silent unknown-key drops:
 * output is validated against {@link tourTripDetailsWireSchema}.
 */
export function compactTripDetailsForApi(
  value: Record<string, unknown> | null | undefined,
): TourTripDetailsWire | undefined {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
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
    const photos = walk(o.photos, "photos");
    if (photos !== undefined) {
      out.photos = photos;
    }
    const location = walk(o.location, "location");
    if (location !== undefined) {
      out.location = location;
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
    if (typeof input === "boolean") {
      return input;
    }
    if (Array.isArray(input)) {
      if (key === "dayPlans") {
        const rows = (input as unknown[])
          .map((row) => walkDayPlanRow(row))
          .filter((r): r is Record<string, unknown> => r != null && Object.keys(r).length > 0);
        return rows.length > 0 ? rows : undefined;
      }
      if (key === "photos") {
        const rows = (input as unknown[])
          .map((row) => stripEphemeralPhotoUrl(walkPhotoRow(row)))
          .filter((r): r is Record<string, unknown> => r != null && Object.keys(r).length > 0);
        return rows.length > 0 ? rows : undefined;
      }
      if (key === "tourThemeIds" || key === "leaderUserIds" || key === "gearRequiredIds" || key === "gearOptionalIds" || key === "guideLanguageIds") {
        const next = filterUuidV4Strings(input);
        return next.length > 0 ? next : undefined;
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

  normalizeLogisticsLegacyAliases(compacted);

  const parsed = tourTripDetailsWireSchema.safeParse(compacted);
  if (!parsed.success) {
    throw new Error(
      `compactTripDetailsForApi: wire contract violation — ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  return parsed.data;
}

/** Normalizes accommodation/meal legacy aliases identically on client egress and server ingress. */
export function normalizeLogisticsLegacyAliases(compacted: Record<string, unknown>): void {
  const logistics = compacted.logistics;
  if (!logistics || typeof logistics !== "object" || Array.isArray(logistics)) {
    return;
  }
  const lg = logistics as Record<string, unknown>;

  const notes =
    typeof lg.transportationNotes === "string" ? String(lg.transportationNotes).trim() : "";
  if (notes.length > 0) {
    lg.transportation = notes;
  }

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
  let mealNotesStr = typeof lg.mealNotes === "string" ? String(lg.mealNotes).trim() : "";
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
}
