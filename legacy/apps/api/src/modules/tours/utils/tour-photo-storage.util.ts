import type { TourTripDetails } from "../types/tour-trip-details.types";

/** Short-lived presigned GET TTL for tour gallery media (never persisted in JSONB). */
export const TOUR_PHOTO_PRESIGNED_URL_TTL_SECONDS = 900;

export type TourGalleryPhotoRef = {
  id: string;
  filename?: string;
  url?: string;
};

/** Immutable object-storage metadata stored in `tripDetails` JSONB (no presigned URL). */
export type TourPhotoPersistedRef = {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};

/** Object-storage key for a tour gallery upload (`MinioStorageAdapter` layout). */
export function tourPhotoStorageKey(
  workspaceId: string,
  tourId: string,
  photoId: string,
  filename: string,
): string {
  return `${workspaceId.trim()}/tours/${tourId.trim()}/photos/${photoId.trim()}-${filename}`;
}

/** Prefix matching all object keys for a given photo id on a tour. */
export function tourPhotoStoragePrefix(workspaceId: string, tourId: string, photoId: string): string {
  return `${workspaceId.trim()}/tours/${tourId.trim()}/photos/${photoId.trim()}-`;
}

function isPhotoRecord(value: unknown): value is TourGalleryPhotoRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return typeof (value as { id?: unknown }).id === "string";
}

/** Walk tripDetails JSON for a photo row by id (root gallery, dayPlans, segmentActivities). */
export function findTourPhotoInTripDetails(
  tripDetails: TourTripDetails | null | undefined,
  photoId: string,
): TourGalleryPhotoRef | null {
  if (tripDetails == null || typeof tripDetails !== "object") {
    return null;
  }
  const target = photoId.trim();
  if (target === "") {
    return null;
  }

  const rootPhotos = tripDetails.photos;
  if (Array.isArray(rootPhotos)) {
    const match = rootPhotos.find((p) => p.id === target);
    if (match) {
      return match;
    }
  }

  const dayPlans = tripDetails.itinerary?.dayPlans;
  if (Array.isArray(dayPlans)) {
    for (const day of dayPlans) {
      const photos = day.photos;
      if (!Array.isArray(photos)) {
        continue;
      }
      const match = photos.find((p) => p.id === target);
      if (match) {
        return match;
      }
    }
  }

  const segmentDays = (tripDetails.itinerary as { segmentActivities?: Array<{ photos?: unknown[] }> } | undefined)
    ?.segmentActivities;
  if (Array.isArray(segmentDays)) {
    for (const day of segmentDays) {
      const photos = day.photos;
      if (!Array.isArray(photos)) {
        continue;
      }
      for (const entry of photos) {
        if (isPhotoRecord(entry) && entry.id === target) {
          return entry;
        }
      }
    }
  }

  return null;
}

function stripUrlFromPhotoRow(row: unknown): unknown {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return row;
  }
  const copy = { ...(row as Record<string, unknown>) };
  delete copy.url;
  return copy;
}

function stripUrlsFromPhotoArray(photos: unknown[] | undefined): unknown[] | undefined {
  if (!Array.isArray(photos)) {
    return photos;
  }
  return photos.map((row) => stripUrlFromPhotoRow(row));
}

/** Removes ephemeral presigned `url` keys before persisting tripDetails JSONB. */
export function stripPhotoUrlsFromTripDetails(
  tripDetails: TourTripDetails,
): TourTripDetails {
  const cloned = JSON.parse(JSON.stringify(tripDetails)) as TourTripDetails;

  if (Array.isArray(cloned.photos)) {
    cloned.photos = stripUrlsFromPhotoArray(cloned.photos) as TourTripDetails["photos"];
  }

  if (cloned.itinerary?.dayPlans) {
    for (const day of cloned.itinerary.dayPlans) {
      if (Array.isArray(day.photos)) {
        day.photos = stripUrlsFromPhotoArray(day.photos) as typeof day.photos;
      }
    }
  }

  const itinerary = cloned.itinerary as
    | { segmentActivities?: Array<{ photos?: unknown[] }> }
    | undefined;
  if (Array.isArray(itinerary?.segmentActivities)) {
    for (const day of itinerary.segmentActivities) {
      if (Array.isArray(day.photos)) {
        day.photos = stripUrlsFromPhotoArray(day.photos) as typeof day.photos;
      }
    }
  }

  return cloned;
}

/** Returns a deep-cloned tripDetails with the photo id removed everywhere it appears. */
export function removeTourPhotoFromTripDetails(
  tripDetails: TourTripDetails,
  photoId: string,
): TourTripDetails {
  const target = photoId.trim();
  const cloned = JSON.parse(JSON.stringify(tripDetails)) as TourTripDetails;

  if (Array.isArray(cloned.photos)) {
    cloned.photos = cloned.photos.filter((p) => p.id !== target);
    if (cloned.photos.length === 0) {
      delete cloned.photos;
    }
  }

  if (cloned.itinerary?.dayPlans) {
    for (const day of cloned.itinerary.dayPlans) {
      if (!Array.isArray(day.photos)) {
        continue;
      }
      day.photos = day.photos.filter((p) => p.id !== target);
      if (day.photos.length === 0) {
        delete day.photos;
      }
    }
  }

  const itinerary = cloned.itinerary as { segmentActivities?: Array<{ photos?: TourGalleryPhotoRef[] }> } | undefined;
  if (Array.isArray(itinerary?.segmentActivities)) {
    for (const day of itinerary.segmentActivities) {
      if (!Array.isArray(day.photos)) {
        continue;
      }
      day.photos = day.photos.filter((p) => p.id !== target);
      if (day.photos.length === 0) {
        delete day.photos;
      }
    }
  }

  return cloned;
}
