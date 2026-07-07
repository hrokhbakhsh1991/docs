import { isDenaliHttpsImageUrl } from "../schemas/denaliFileAssetSchema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readFirstPhotoRecord(photos: unknown): Record<string, unknown> | null {
  if (Array.isArray(photos)) {
    const first = photos[0];
    return isRecord(first) ? first : null;
  }
  if (!isRecord(photos)) {
    return null;
  }
  const items = photos.items ?? photos.entries ?? photos.photos;
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const first = items[0];
  return isRecord(first) ? first : null;
}

/**
 * Resolve photo rows from stored Denali canonical `data`.
 * Matches edit hydrate + clone remint — supports flat `photos[]` and legacy `photosData.photos`.
 */
export function readDenaliCanonicalPhotoRows(
  canonicalData: Record<string, unknown>
): readonly Record<string, unknown>[] {
  const photosRoot = canonicalData.photos;
  if (Array.isArray(photosRoot)) {
    return photosRoot.filter(isRecord);
  }
  if (isRecord(photosRoot)) {
    for (const key of ["photos", "items", "entries"] as const) {
      const nested = photosRoot[key];
      if (Array.isArray(nested)) {
        return nested.filter(isRecord);
      }
    }
  }

  const photosData = canonicalData.photosData;
  if (isRecord(photosData) && Array.isArray(photosData.photos)) {
    return photosData.photos.filter(isRecord);
  }

  return [];
}

/** First canonical photo HTTPS url when present and egress-safe. */
export function readDenaliFirstPhotoHttpsUrl(photos: unknown): string | null {
  const first = readFirstPhotoRecord(photos);
  if (first === null) {
    return null;
  }
  const url = readString(first.url);
  if (url === null || !isDenaliHttpsImageUrl(url)) {
    return null;
  }
  return url;
}

/** First canonical photo MinIO key — used by operator list cover signing. */
export function readDenaliFirstPhotoStorageKey(photos: unknown): string | null {
  const first = readFirstPhotoRecord(photos);
  if (first === null) {
    return null;
  }
  return readString(first.storageKey);
}
