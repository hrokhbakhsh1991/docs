import type {
  PublicCatalogItineraryDay,
  PublicCatalogItinerarySegment,
} from "@app-tour/workspace-sdk";

import { isDenaliCatalogProjectableImageUrl } from "../schemas/denaliFileAssetSchema";
import { parseDenaliItineraryDays, type DenaliItinerarySegment } from "../schemas/denaliItineraryDaySchema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function snapCatalogDifficultyLevel(value: number): number {
  const snapped = Math.round(value / 0.5) * 0.5;
  return Math.min(10, Math.max(1, snapped));
}

function buildPhotoUrlById(photos: unknown): ReadonlyMap<string, string> {
  const byId = new Map<string, string>();
  const entries = Array.isArray(photos) ? photos : [];
  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }
    const id = readString(entry.id);
    const url = readString(entry.url);
    if (id == null || url == null || !isDenaliCatalogProjectableImageUrl(url)) {
      continue;
    }
    byId.set(id, url);
  }
  return byId;
}

function projectSegmentPhotoUrls(
  segment: DenaliItinerarySegment,
  photoUrlById: ReadonlyMap<string, string>
): readonly string[] | undefined {
  const photoIds = segment.photoIds;
  if (photoIds == null || photoIds.length === 0) {
    return undefined;
  }
  const urls = photoIds
    .map((photoId) => photoUrlById.get(photoId))
    .filter((url): url is string => url != null && url.length > 0);
  return urls.length > 0 ? urls : undefined;
}

function resolveSegmentLocationLabel(
  segment: DenaliItinerarySegment,
  destinationNameById: ReadonlyMap<string, string> | undefined
): string | undefined {
  const manual = segment.locationLabel?.trim();
  if (manual != null && manual.length > 0) {
    return manual;
  }
  const destinationId = segment.destinationId?.trim();
  if (destinationId == null || destinationId.length === 0 || destinationNameById == null) {
    return undefined;
  }
  const resolved = destinationNameById.get(destinationId)?.trim();
  return resolved != null && resolved.length > 0 ? resolved : undefined;
}

function projectSegment(
  segment: DenaliItinerarySegment,
  photoUrlById: ReadonlyMap<string, string>,
  destinationNameById: ReadonlyMap<string, string> | undefined
): PublicCatalogItinerarySegment | null {
  const title = segment.title.trim();
  if (title.length === 0) {
    return null;
  }
  const photoUrls = projectSegmentPhotoUrls(segment, photoUrlById);
  const locationLabel = resolveSegmentLocationLabel(segment, destinationNameById);
  return Object.freeze({
    title,
    ...(segment.kind ? { kind: segment.kind } : {}),
    ...(segment.startTime?.trim() ? { startTime: segment.startTime.trim() } : {}),
    ...(locationLabel != null ? { locationLabel } : {}),
    ...(photoUrls != null ? { photoUrls } : {}),
  });
}

function dayHasPublicContent(day: ReturnType<typeof parseDenaliItineraryDays>[number]): boolean {
  return (
    day.title.trim().length > 0 ||
    (day.summary?.trim().length ?? 0) > 0 ||
    day.segments.some((segment) => segment.title.trim().length > 0)
  );
}

export type ProjectDenaliCatalogItineraryOptions = {
  readonly destinationNameById?: ReadonlyMap<string, string>;
  /** Signed MinIO read URLs keyed by canonical photo id (public catalog enrichment). */
  readonly photoUrlById?: ReadonlyMap<string, string>;
};

function mergePhotoUrlById(
  photos: unknown,
  enrichment?: ReadonlyMap<string, string>
): ReadonlyMap<string, string> {
  const fromHttps = buildPhotoUrlById(photos);
  if (enrichment == null || enrichment.size === 0) {
    return fromHttps;
  }
  const merged = new Map(fromHttps);
  for (const [id, url] of enrichment) {
    merged.set(id, url);
  }
  return merged;
}

/** Collect tour + segment `destinationId` values for host catalog enrichment. */
export function collectItinerarySegmentDestinationIds(data: Record<string, unknown>): readonly string[] {
  const days = parseDenaliItineraryDays(readCanonicalPath(data, "program.itinerary"));
  const ids = new Set<string>();
  const rootDestinationId = readString(data.destinationId);
  if (rootDestinationId != null) {
    ids.add(rootDestinationId);
  }
  for (const day of days) {
    for (const segment of day.segments) {
      const destinationId = segment.destinationId?.trim();
      if (destinationId != null && destinationId.length > 0) {
        ids.add(destinationId);
      }
    }
  }
  return Object.freeze([...ids]);
}

/** Map canonical `program.itinerary` to egress-safe catalog rows (no internal ids). */
export function projectDenaliCatalogItinerary(
  data: Record<string, unknown>,
  options?: ProjectDenaliCatalogItineraryOptions
): readonly PublicCatalogItineraryDay[] | undefined {
  const photoUrlById = mergePhotoUrlById(data.photos, options?.photoUrlById);
  const destinationNameById = options?.destinationNameById;
  const days = parseDenaliItineraryDays(readCanonicalPath(data, "program.itinerary")).filter(
    dayHasPublicContent
  );
  if (days.length === 0) {
    return undefined;
  }

  const projected = days
    .map((day) => {
      const segments = day.segments
        .map((segment) => projectSegment(segment, photoUrlById, destinationNameById))
        .filter((segment): segment is PublicCatalogItinerarySegment => segment != null);
      const title = day.title.trim();
      const summary = day.summary?.trim();
      if (title.length === 0 && segments.length === 0 && (summary?.length ?? 0) === 0) {
        return null;
      }
      return Object.freeze({
        dayNumber: day.dayNumber,
        title: title.length > 0 ? title : `Day ${day.dayNumber}`,
        ...(summary != null && summary.length > 0 ? { summary } : {}),
        segments: Object.freeze(segments),
      });
    })
    .filter((day): day is PublicCatalogItineraryDay => day != null);

  return projected.length > 0 ? Object.freeze(projected) : undefined;
}

export function readDenaliCatalogDifficultyLevel(data: Record<string, unknown>): number | null {
  const raw = readCanonicalPath(data, "program.difficultyLevel");
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return snapCatalogDifficultyLevel(raw);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number.parseFloat(raw.trim());
    if (Number.isFinite(parsed)) {
      return snapCatalogDifficultyLevel(parsed);
    }
  }
  return null;
}

export function readDenaliCatalogFitnessLevel(data: Record<string, unknown>): string | null {
  return readString(readCanonicalPath(data, "participants.fitnessLevel"));
}
