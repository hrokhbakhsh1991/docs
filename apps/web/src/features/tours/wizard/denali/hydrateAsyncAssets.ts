import type { TourDetailDto } from "@/lib/services/tours.service";

import type { DenaliFileAsset } from "@/features/tours/wizard/schemas/denaliFileAssetSchema";

/** Wire / registry async asset reference (may omit preview `url`). */
export type AsyncAsset = {
  id?: string;
  assetId?: string;
  url?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
  uploadStatus?: DenaliFileAsset["uploadStatus"];
};

function trimNonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseAsyncAssetRow(raw: unknown): AsyncAsset | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = trimNonEmpty(row.id);
  const assetId = trimNonEmpty(row.assetId);
  const url = trimNonEmpty(row.url);
  if (!id && !assetId && !url) {
    return null;
  }
  return {
    ...(id ? { id } : {}),
    ...(assetId ? { assetId } : {}),
    ...(url ? { url } : {}),
    ...(trimNonEmpty(row.filename) ? { filename: trimNonEmpty(row.filename) } : {}),
    ...(typeof row.size === "number" && Number.isFinite(row.size) ? { size: row.size } : {}),
    ...(trimNonEmpty(row.mimeType) ? { mimeType: trimNonEmpty(row.mimeType) } : {}),
    ...(trimNonEmpty(row.uploadedAt) ? { uploadedAt: trimNonEmpty(row.uploadedAt) } : {}),
    ...(trimNonEmpty(row.uploadStatus) &&
    (row.uploadStatus === "pending" ||
      row.uploadStatus === "uploading" ||
      row.uploadStatus === "uploaded" ||
      row.uploadStatus === "failed")
      ? { uploadStatus: row.uploadStatus as DenaliFileAsset["uploadStatus"] }
      : {}),
  };
}

/** Reads gallery async assets from API `details.tripDetails.photos` before RHF mapping. */
export function readTourGalleryAsyncAssets(
  tour: Pick<TourDetailDto, "details"> | { details?: { tripDetails?: unknown } | null },
): AsyncAsset[] {
  const tripDetails = tour.details?.tripDetails;
  if (tripDetails == null || typeof tripDetails !== "object" || Array.isArray(tripDetails)) {
    return [];
  }
  const rawPhotos = (tripDetails as Record<string, unknown>).photos;
  if (!Array.isArray(rawPhotos)) {
    return [];
  }
  return rawPhotos
    .map((row) => parseAsyncAssetRow(row))
    .filter((row): row is AsyncAsset => row != null);
}

function assetLookupKeys(row: AsyncAsset): string[] {
  const keys = new Set<string>();
  const id = trimNonEmpty(row.id);
  const assetId = trimNonEmpty(row.assetId);
  if (id) {
    keys.add(id);
  }
  if (assetId) {
    keys.add(assetId);
  }
  return [...keys];
}

function toHydratedAsset(row: AsyncAsset, url: string): DenaliFileAsset | null {
  const id = trimNonEmpty(row.id) ?? trimNonEmpty(row.assetId);
  if (!id) {
    return null;
  }
  const assetId = trimNonEmpty(row.assetId) ?? id;
  return {
    id,
    url,
    filename: trimNonEmpty(row.filename) ?? "photo.jpg",
    size: typeof row.size === "number" && Number.isFinite(row.size) ? row.size : 0,
    mimeType: trimNonEmpty(row.mimeType) ?? "image/jpeg",
    uploadedAt: trimNonEmpty(row.uploadedAt) ?? new Date(0).toISOString(),
    assetId,
    uploadStatus: row.uploadStatus ?? "uploaded",
  };
}

function buildResolvedAssetIndex(photos: readonly AsyncAsset[]): Map<string, DenaliFileAsset> {
  const index = new Map<string, DenaliFileAsset>();
  for (const row of photos) {
    const url = trimNonEmpty(row.url);
    if (!url) {
      continue;
    }
    const hydrated = toHydratedAsset(row, url);
    if (!hydrated) {
      continue;
    }
    for (const key of assetLookupKeys(row)) {
      index.set(key, hydrated);
    }
    index.set(hydrated.id, hydrated);
    if (hydrated.assetId) {
      index.set(hydrated.assetId, hydrated);
    }
  }
  return index;
}

/**
 * Resolves registry async assets (possibly installId references) into full file rows for RHF/UI.
 * Rows with a preview `url` pass through; assetId-only rows inherit metadata from indexed matches.
 */
export function hydrateAsyncAssets(photos: readonly AsyncAsset[]): DenaliFileAsset[] {
  if (photos.length === 0) {
    return [];
  }

  const index = buildResolvedAssetIndex(photos);
  const seenIds = new Set<string>();
  const hydrated: DenaliFileAsset[] = [];

  for (const row of photos) {
    const directUrl = trimNonEmpty(row.url);
    let resolved =
      directUrl != null ? toHydratedAsset(row, directUrl) : null;

    if (!resolved) {
      for (const key of assetLookupKeys(row)) {
        const match = index.get(key);
        if (match) {
          resolved = {
            ...match,
            id: trimNonEmpty(row.id) ?? match.id,
            assetId: trimNonEmpty(row.assetId) ?? match.assetId ?? match.id,
            ...(trimNonEmpty(row.filename) ? { filename: trimNonEmpty(row.filename)! } : {}),
            ...(typeof row.size === "number" && Number.isFinite(row.size) ? { size: row.size } : {}),
            ...(trimNonEmpty(row.mimeType) ? { mimeType: trimNonEmpty(row.mimeType)! } : {}),
            ...(trimNonEmpty(row.uploadedAt) ? { uploadedAt: trimNonEmpty(row.uploadedAt)! } : {}),
            ...(row.uploadStatus ? { uploadStatus: row.uploadStatus } : {}),
          };
          break;
        }
      }
    }

    if (!resolved || seenIds.has(resolved.id)) {
      continue;
    }
    seenIds.add(resolved.id);
    hydrated.push(resolved);
  }

  return hydrated;
}
