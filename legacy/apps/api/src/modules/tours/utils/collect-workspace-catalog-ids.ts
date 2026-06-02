import type { TourTripDetails } from "../types/tour-trip-details.types";

function dedupeUuidStrings(ids: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of ids) {
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

/**
 * Collects workspace-catalog UUID references stored in trip JSONB
 * (`gear*Ids`, `tourThemeIds`, `guideLanguageIds`).
 */
export function collectWorkspaceCatalogIds(trip: TourTripDetails | null | undefined): {
  equipmentIds: string[];
  tourThemeIds: string[];
  guideLanguageIds: string[];
} {
  if (trip == null || typeof trip !== "object") {
    return { equipmentIds: [], tourThemeIds: [], guideLanguageIds: [] };
  }

  const p = trip.participation;
  const o = trip.overview;
  const l = trip.logistics;

  const gearReq = Array.isArray(p?.gearRequiredIds) ? p!.gearRequiredIds : [];
  const gearOpt = Array.isArray(p?.gearOptionalIds) ? p!.gearOptionalIds : [];

  return {
    equipmentIds: dedupeUuidStrings([...gearReq, ...gearOpt]),
    tourThemeIds: dedupeStringsSafe(o?.tourThemeIds),
    guideLanguageIds: dedupeStringsSafe(l?.guideLanguageIds),
  };
}

function dedupeStringsSafe(raw: unknown): string[] {
  return Array.isArray(raw) ? dedupeUuidStrings(raw) : [];
}
