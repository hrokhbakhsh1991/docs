import { createClientSafeUuid } from "@app-tour/draft-engine";

export type PlatformLocationZone = {
  readonly id: string;
  readonly label: string;
  readonly lat?: number;
  readonly lng?: number;
};

export type PlatformLocationData = {
  readonly zones?: readonly PlatformLocationZone[];
  readonly address?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function parsePlatformLocationData(value: unknown): PlatformLocationData {
  if (!isRecord(value)) {
    return {};
  }
  const address = typeof value.address === "string" ? value.address : undefined;
  const zonesRaw = value.zones;
  if (!Array.isArray(zonesRaw)) {
    return { address, zones: [] };
  }
  const zones: PlatformLocationZone[] = [];
  for (const entry of zonesRaw) {
    if (!isRecord(entry)) {
      continue;
    }
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const label = typeof entry.label === "string" ? entry.label : "";
    if (id.length === 0) {
      continue;
    }
    zones.push({
      id,
      label,
      lat: parseOptionalNumber(entry.lat),
      lng: parseOptionalNumber(entry.lng),
    });
  }
  return { address, zones };
}

export function newPlatformLocationZoneId(): string {
  return createClientSafeUuid();
}

export function serializePlatformLocationData(data: PlatformLocationData): Record<string, unknown> {
  return {
    ...(data.address !== undefined && data.address.length > 0 ? { address: data.address } : {}),
    zones: (data.zones ?? []).map((zone) => ({
      id: zone.id,
      label: zone.label,
      ...(zone.lat !== undefined ? { lat: zone.lat } : {}),
      ...(zone.lng !== undefined ? { lng: zone.lng } : {}),
    })),
  };
}
