import { toAsciiDigits } from "@/i18n/format-localized-digits";

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
  return {
    ...(typeof record.label === "string" ? { label: record.label } : {}),
    ...(typeof record.address === "string" ? { address: record.address } : {}),
    ...(typeof record.latitude === "number" && Number.isFinite(record.latitude)
      ? { latitude: record.latitude }
      : {}),
    ...(typeof record.longitude === "number" && Number.isFinite(record.longitude)
      ? { longitude: record.longitude }
      : {}),
  };
}

export function parseDenaliGatheringPoints(value: unknown): DenaliGatheringPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object")
    .map((entry) => ({
      ...(typeof entry.name === "string" ? { name: entry.name } : {}),
      ...(typeof entry.address === "string" ? { address: entry.address } : {}),
      ...(typeof entry.latitude === "number" && Number.isFinite(entry.latitude)
        ? { latitude: entry.latitude }
        : {}),
      ...(typeof entry.longitude === "number" && Number.isFinite(entry.longitude)
        ? { longitude: entry.longitude }
        : {}),
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
