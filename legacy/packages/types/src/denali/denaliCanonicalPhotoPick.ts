import type { DenaliCanonicalTourModel } from "./denaliCanonicalTourModel";

/** Wizard / UI photo row before canonical sanitization (may carry upload-only fields). */
export type DenaliWizardPhotoRowInput = {
  id?: string;
  url?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
  assetId?: string;
  uploadStatus?: string;
};

export type DenaliCanonicalGalleryPhoto = NonNullable<DenaliCanonicalTourModel["photos"]>[number];

export type DenaliCanonicalItineraryDayPhoto = NonNullable<
  NonNullable<DenaliCanonicalTourModel["program"]["itinerary"]>[number]["photos"]
>[number];

/** Gallery photo: strict canonical fields only (matches submit Zod `.strict()`). */
export function pickDenaliCanonicalGalleryPhoto(
  row: DenaliWizardPhotoRowInput,
): DenaliCanonicalGalleryPhoto | null {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const url = typeof row.url === "string" ? row.url.trim() : "";
  const filename = typeof row.filename === "string" ? row.filename.trim() : "";
  const mimeType = typeof row.mimeType === "string" ? row.mimeType.trim() : "";
  const uploadedAt = typeof row.uploadedAt === "string" ? row.uploadedAt.trim() : "";
  if (!id || !url || !filename || !mimeType || !uploadedAt) {
    return null;
  }
  if (typeof row.size !== "number" || !Number.isFinite(row.size) || row.size < 0) {
    return null;
  }
  return {
    id,
    url,
    filename,
    size: row.size,
    mimeType,
    uploadedAt,
  };
}

export function pickDenaliCanonicalGalleryPhotos(
  photos: readonly DenaliWizardPhotoRowInput[] | undefined,
): DenaliCanonicalTourModel["photos"] {
  if (photos == null || photos.length === 0) {
    return undefined;
  }
  const picked: DenaliCanonicalGalleryPhoto[] = [];
  for (const row of photos) {
    const photo = pickDenaliCanonicalGalleryPhoto(row);
    if (photo != null) {
      picked.push(photo);
    }
  }
  return picked.length > 0 ? picked : undefined;
}

/** Itinerary day photo: id + url required; optional metadata without UI-only keys. */
export function pickDenaliCanonicalItineraryDayPhoto(
  row: DenaliWizardPhotoRowInput,
): DenaliCanonicalItineraryDayPhoto | null {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const url = typeof row.url === "string" ? row.url.trim() : "";
  if (!id || !url) {
    return null;
  }
  const out: DenaliCanonicalItineraryDayPhoto = { id, url };
  const filename = typeof row.filename === "string" ? row.filename.trim() : "";
  if (filename) {
    out.filename = filename;
  }
  if (typeof row.size === "number" && Number.isFinite(row.size) && row.size >= 0) {
    out.size = row.size;
  }
  const mimeType = typeof row.mimeType === "string" ? row.mimeType.trim() : "";
  if (mimeType) {
    out.mimeType = mimeType;
  }
  const uploadedAt = typeof row.uploadedAt === "string" ? row.uploadedAt.trim() : "";
  if (uploadedAt) {
    out.uploadedAt = uploadedAt;
  }
  return out;
}

export function pickDenaliCanonicalItineraryDayPhotos(
  photos: readonly DenaliWizardPhotoRowInput[] | undefined,
): DenaliCanonicalItineraryDayPhoto[] | undefined {
  if (photos == null || photos.length === 0) {
    return undefined;
  }
  const picked: DenaliCanonicalItineraryDayPhoto[] = [];
  for (const row of photos) {
    const photo = pickDenaliCanonicalItineraryDayPhoto(row);
    if (photo != null) {
      picked.push(photo);
    }
  }
  return picked.length > 0 ? picked : undefined;
}
