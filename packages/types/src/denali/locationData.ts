/**
 * Unified 5-zone location pin for Denali wizard (gathering → end).
 * @see maplog Phase 7 — LocationData contract
 */

export type DenaliLocationData = {
  addressText: string;
  latitude: number | null;
  longitude: number | null;
};

export const DENALI_LOCATION_ZONE_KEYS = [
  "startPoint",
  "summitPoint",
  "campPoint",
  "endPoint",
] as const;

export type DenaliLocationZoneKey = (typeof DENALI_LOCATION_ZONE_KEYS)[number];

export function denaliLocationFromText(
  addressText: string | undefined,
  coords?: { latitude?: number | null; longitude?: number | null },
): DenaliLocationData | undefined {
  const text = addressText?.trim();
  if (!text && coords?.latitude == null && coords?.longitude == null) {
    return undefined;
  }
  return {
    addressText: text ?? "",
    latitude:
      typeof coords?.latitude === "number" && Number.isFinite(coords.latitude)
        ? coords.latitude
        : null,
    longitude:
      typeof coords?.longitude === "number" && Number.isFinite(coords.longitude)
        ? coords.longitude
        : null,
  };
}

export function denaliLocationFromApi(raw: unknown): DenaliLocationData | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t ? { addressText: t, latitude: null, longitude: null } : undefined;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const row = raw as Record<string, unknown>;
  const addressText = typeof row.addressText === "string" ? row.addressText.trim() : "";
  const latitude =
    typeof row.latitude === "number" && Number.isFinite(row.latitude) ? row.latitude : null;
  const longitude =
    typeof row.longitude === "number" && Number.isFinite(row.longitude) ? row.longitude : null;
  if (!addressText && latitude == null && longitude == null) return undefined;
  return { addressText, latitude, longitude };
}

export function denaliLocationAddressText(loc: DenaliLocationData | undefined): string | undefined {
  const t = loc?.addressText?.trim();
  return t || undefined;
}
