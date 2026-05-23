/**
 * Multi-station pickup rows for Denali (`tripDetails.logistics.gatheringPoints`).
 * Phase 16.13 — nested topology: title + time + location pin.
 */

import { denaliLocationFromApi, type DenaliLocationData } from "./locationData";

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type DenaliGatheringPickupStation = {
  /** Stable row id for React Hook Form `useFieldArray` (optional on API persist). */
  id?: string;
  /** Human label, e.g. «میدان رسالت». */
  title: string;
  /** Local assembly clock time (`HH:mm`). */
  time?: string;
  location: DenaliLocationData;
};

export const EMPTY_GATHERING_PICKUP_STATION: DenaliGatheringPickupStation = {
  title: "",
  location: { addressText: "", latitude: null, longitude: null },
};

function stationHasContent(station: DenaliGatheringPickupStation): boolean {
  const title = station.title.trim();
  const time = station.time?.trim();
  const loc = station.location;
  const hasLoc =
    Boolean(loc.addressText.trim()) ||
    (typeof loc.latitude === "number" && Number.isFinite(loc.latitude)) ||
    (typeof loc.longitude === "number" && Number.isFinite(loc.longitude));
  return Boolean(title || time || hasLoc);
}

/** Normalizes nested rows and legacy flat location blobs into the canonical nested shape. */
export function normalizeGatheringPickupStation(raw: unknown): DenaliGatheringPickupStation | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;

  if (row.location != null) {
    const location = denaliLocationFromApi(row.location);
    if (!location) {
      return null;
    }
    const title =
      typeof row.title === "string" && row.title.trim()
        ? row.title.trim()
        : location.addressText.trim() || "ایستگاه تجمع";
    const time =
      typeof row.time === "string" && HHMM_RE.test(row.time.trim()) ? row.time.trim() : undefined;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : undefined;
    const station: DenaliGatheringPickupStation = { title, time, location };
    if (id) {
      station.id = id;
    }
    return stationHasContent(station) ? station : null;
  }

  const flatLocation = denaliLocationFromApi(row);
  if (!flatLocation) {
    return null;
  }
  const title =
    typeof row.title === "string" && row.title.trim()
      ? row.title.trim()
      : flatLocation.addressText.trim() || "ایستگاه تجمع";
  const time =
    typeof row.time === "string" && HHMM_RE.test(row.time.trim()) ? row.time.trim() : undefined;
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : undefined;
  const station: DenaliGatheringPickupStation = {
    title,
    time,
    location: {
      addressText: flatLocation.addressText,
      latitude: flatLocation.latitude,
      longitude: flatLocation.longitude,
    },
  };
  if (id) {
    station.id = id;
  }
  return stationHasContent(station) ? station : null;
}

export function normalizeGatheringPickupStations(raw: unknown): DenaliGatheringPickupStation[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => normalizeGatheringPickupStation(entry))
    .filter((row): row is DenaliGatheringPickupStation => row != null);
}

/** Publish gate: non-empty title, address, and finite coordinates. */
export function gatheringPickupStationIsConcrete(station: DenaliGatheringPickupStation): boolean {
  if (station.title.trim() === "") {
    return false;
  }
  const loc = station.location;
  if (loc.addressText.trim() === "") {
    return false;
  }
  return (
    typeof loc.latitude === "number" &&
    Number.isFinite(loc.latitude) &&
    typeof loc.longitude === "number" &&
    Number.isFinite(loc.longitude)
  );
}

/** Maps a single legacy `overview.gatheringPoint` pin into one nested station. */
export function gatheringPickupStationFromLegacyLocation(
  legacy: DenaliLocationData,
  opts?: { title?: string; time?: string; id?: string },
): DenaliGatheringPickupStation {
  const station: DenaliGatheringPickupStation = {
    title: opts?.title?.trim() || legacy.addressText.trim() || "ایستگاه تجمع",
    time: opts?.time,
    location: {
      addressText: legacy.addressText,
      latitude: legacy.latitude,
      longitude: legacy.longitude,
    },
  };
  if (opts?.id?.trim()) {
    station.id = opts.id.trim();
  }
  return station;
}

export function gatheringPickupStationToPersisted(
  station: DenaliGatheringPickupStation,
): { title: string; time?: string; location: DenaliLocationData } {
  return {
    title: station.title.trim(),
    ...(station.time?.trim() ? { time: station.time.trim() } : {}),
    location: {
      addressText: station.location.addressText.trim(),
      latitude: station.location.latitude,
      longitude: station.location.longitude,
    },
  };
}
