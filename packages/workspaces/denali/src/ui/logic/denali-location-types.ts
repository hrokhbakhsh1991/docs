import { toAsciiDigits } from "../adapters/i18n-format";

export type DenaliLocationData = {
  readonly label?: string;
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
};

export type DenaliGatheringPoint = {
  readonly name?: string;
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly isPrimary?: boolean;
};

export const DENALI_LOCATION_ZONE_PATHS = [
  { path: "startPoint" },
  { path: "summitPoint" },
  { path: "campPoint" },
  { path: "endPoint" },
] as const;

export type DenaliLocationZonePath = (typeof DENALI_LOCATION_ZONE_PATHS)[number]["path"];

export const DENALI_COMPOSITE_TEST_IDS = {
  destination: "denali-composite-destination",
  locationZones: "denali-composite-location-zones",
  gatheringPoints: "denali-composite-gathering-points",
  mapPreview: "denali-composite-map-preview",
} as const;

export function parseDenaliLocationData(value: unknown): DenaliLocationData {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const address =
    typeof record.address === "string"
      ? record.address
      : typeof record.addressText === "string"
        ? record.addressText
        : undefined;
  return {
    ...(typeof record.label === "string" ? { label: record.label } : {}),
    ...(address !== undefined ? { address } : {}),
    ...(typeof record.latitude === "number" && Number.isFinite(record.latitude)
      ? { latitude: record.latitude }
      : {}),
    ...(typeof record.longitude === "number" && Number.isFinite(record.longitude)
      ? { longitude: record.longitude }
      : {}),
  };
}

/** True when the zone has any operator-entered label, address, or coordinates (INV-DENALI-WIZ-019). */
export function isDenaliLocationDataPopulated(location: DenaliLocationData): boolean {
  if ((location.label ?? "").trim().length > 0) {
    return true;
  }
  if ((location.address ?? "").trim().length > 0) {
    return true;
  }
  return (
    location.latitude !== undefined &&
    location.longitude !== undefined &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  );
}

function readLegacyLocationFields(entry: Record<string, unknown>): Partial<DenaliGatheringPoint> {
  const location =
    entry.location !== null && typeof entry.location === "object" && !Array.isArray(entry.location)
      ? (entry.location as Record<string, unknown>)
      : null;

  const address =
    typeof entry.address === "string"
      ? entry.address
      : typeof entry.addressText === "string"
        ? entry.addressText
        : typeof location?.addressText === "string"
          ? location.addressText
          : undefined;

  const latitude =
    typeof entry.latitude === "number" && Number.isFinite(entry.latitude)
      ? entry.latitude
      : typeof location?.latitude === "number" && Number.isFinite(location.latitude)
        ? location.latitude
        : undefined;

  const longitude =
    typeof entry.longitude === "number" && Number.isFinite(entry.longitude)
      ? entry.longitude
      : typeof location?.longitude === "number" && Number.isFinite(location.longitude)
        ? location.longitude
        : undefined;

  const name =
    typeof entry.name === "string"
      ? entry.name
      : typeof entry.title === "string"
        ? entry.title
        : undefined;

  return {
    ...(name !== undefined ? { name } : {}),
    ...(address !== undefined ? { address } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
  };
}

export function createEmptyDenaliGatheringPoint(isPrimary = false): DenaliGatheringPoint {
  return isPrimary ? { name: "", isPrimary: true } : { name: "" };
}

export function parseDenaliGatheringPoints(value: unknown): DenaliGatheringPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object")
    .map((entry) => ({
      ...readLegacyLocationFields(entry),
      ...(entry.isPrimary === true ? { isPrimary: true } : {}),
    }));
}

export function parseCoordinateInput(raw: string): number | undefined {
  const trimmed = toAsciiDigits(raw).trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function openStreetMapLink(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`;
}

export function openStreetMapEmbedUrl(latitude: number, longitude: number): string {
  const delta = 0.02;
  const west = longitude - delta;
  const south = latitude - delta;
  const east = longitude + delta;
  const north = latitude + delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}
