/**
 * ACL boundary — normalizes legacy `trip_details` blobs into canonical-friendly shapes.
 * Phase 6.2 scaffold: identity pass-through for golden fixtures (full port in 6.5+).
 */

export type LegacyTripDetailsBlob = Record<string, unknown>;

export function normalizeLegacyTripDetails(
  raw: LegacyTripDetailsBlob | null | undefined
): LegacyTripDetailsBlob {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...raw };
}
