import type { TourTripDetails } from "../types/tour-trip-details.types";

/**
 * Deep-merge `patch` into a clone of `existing` (plain JSON).
 * - Omitted keys in `patch` leave the previous value unchanged.
 * - `null` in `patch` removes that key (useful for clearing a subgroup when clients send explicit null).
 * - Arrays are replaced in full when present in `patch`.
 */
export function mergeTourTripDetails(
  existing: TourTripDetails | null | undefined,
  patch: TourTripDetails
): TourTripDetails {
  const base: Record<string, unknown> =
    existing != null ? JSON.parse(JSON.stringify(existing)) : {};
  return mergeDeepRecord(base, patch as Record<string, unknown>) as TourTripDetails;
}

function mergeDeepRecord(
  target: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    if (pv === undefined) {
      continue;
    }
    if (pv === null) {
      delete out[key];
      continue;
    }
    const tv = out[key];
    if (Array.isArray(pv)) {
      out[key] = pv;
      continue;
    }
    if (typeof pv === "object") {
      out[key] = mergeDeepRecord(
        typeof tv === "object" && tv !== null && !Array.isArray(tv)
          ? (tv as Record<string, unknown>)
          : {},
        pv as Record<string, unknown>
      );
      continue;
    }
    out[key] = pv;
  }
  return out;
}
