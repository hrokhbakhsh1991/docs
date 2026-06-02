import type { DenaliItineraryDayPhoto, DenaliItineraryDayRow } from "./denaliItinerarySync";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

export type DenaliWizardPhotoRow = {
  id: string;
  url: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
};

export function isClientBlobUrl(url: string | undefined | null): url is string {
  return typeof url === "string" && url.startsWith("blob:");
}

/** Release an object URL created via `URL.createObjectURL` (no-op for https URLs). */
export function revokeDenaliBlobUrl(url: string | undefined | null): void {
  if (!isClientBlobUrl(url)) {
    return;
  }
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Already revoked or environment lacks URL API.
  }
}

export function revokeBlobUrlsFromPhotoRows(
  photos: readonly { url?: string | null }[] | undefined,
): void {
  for (const row of photos ?? []) {
    revokeDenaliBlobUrl(row.url);
  }
}

/** Revoke all in-session blob previews on gallery + itinerary before a structural form reset. */
export function revokeBlobUrlsFromDenaliForm(form: DenaliCreateTourWizardForm): void {
  revokeBlobUrlsFromPhotoRows(form.photosData?.photos);
  for (const day of form.programNature.itinerary ?? []) {
    revokeBlobUrlsFromPhotoRows(day.photos);
  }
}

function hasBlobPhotos(photos: readonly DenaliWizardPhotoRow[] | undefined): boolean {
  return (photos ?? []).some((p) => isClientBlobUrl(p.url));
}

/**
 * Merge blob-backed photo rows from `before` into `after`, preserving object identity for blob URLs.
 */
function mergeBlobPhotoLists(
  before: readonly DenaliWizardPhotoRow[] | undefined,
  after: readonly DenaliWizardPhotoRow[] | undefined,
): DenaliWizardPhotoRow[] | undefined {
  const beforeRows = before ?? [];
  const afterRows = [...(after ?? [])];
  if (!hasBlobPhotos(beforeRows)) {
    return afterRows.length > 0 ? afterRows : after ? [...after] : undefined;
  }

  const blobById = new Map(
    beforeRows.filter((p) => isClientBlobUrl(p.url)).map((p) => [p.id, p] as const),
  );
  if (blobById.size === 0) {
    return afterRows.length > 0 ? afterRows : after ? [...after] : undefined;
  }

  const afterIds = new Set(afterRows.map((p) => p.id));
  const merged: DenaliWizardPhotoRow[] = afterRows.map((row) => {
    const blob = blobById.get(row.id);
    return blob ?? row;
  });

  for (const blobRow of blobById.values()) {
    if (!afterIds.has(blobRow.id)) {
      merged.push(blobRow);
    }
  }

  return merged.length > 0 ? merged : undefined;
}

function mergeItineraryBlobPhotos(
  beforeItinerary: DenaliItineraryDayRow[] | undefined,
  afterItinerary: DenaliItineraryDayRow[] | undefined,
): DenaliItineraryDayRow[] | undefined {
  if (afterItinerary == null) {
    return undefined;
  }
  const beforeByDay = new Map((beforeItinerary ?? []).map((row) => [row.day, row] as const));

  return afterItinerary.map((dayRow) => {
    const prevDay = beforeByDay.get(dayRow.day);
    if (prevDay == null || !hasBlobPhotos(prevDay.photos)) {
      return dayRow;
    }
    const photos = mergeBlobPhotoLists(
      prevDay.photos as DenaliWizardPhotoRow[] | undefined,
      dayRow.photos as DenaliWizardPhotoRow[] | undefined,
    );
    if (photos === dayRow.photos) {
      return dayRow;
    }
    return {
      ...dayRow,
      photos: photos as DenaliItineraryDayPhoto[] | undefined,
    };
  });
}

/**
 * After invariant normalization / reset, re-attach in-browser blob: media from the pre-reset snapshot.
 */
export function preserveDenaliWizardBlobMedia(
  before: DenaliCreateTourWizardForm,
  after: DenaliCreateTourWizardForm,
): DenaliCreateTourWizardForm {
  let next = after;

  const beforeGallery = before.photosData?.photos;
  const afterGallery = after.photosData?.photos;
  const mergedGallery = mergeBlobPhotoLists(beforeGallery, afterGallery);
  if (mergedGallery !== afterGallery) {
    next = {
      ...next,
      photosData: {
        ...next.photosData,
        photos: (mergedGallery ?? []) as NonNullable<
          DenaliCreateTourWizardForm["photosData"]
        >["photos"],
      },
    };
  }

  const beforeItinerary = before.programNature.itinerary;
  const afterItinerary = after.programNature.itinerary;
  if (afterItinerary != null && beforeItinerary != null) {
    const mergedItinerary = mergeItineraryBlobPhotos(beforeItinerary, afterItinerary);
    if (mergedItinerary !== afterItinerary) {
      next = {
        ...next,
        programNature: {
          ...next.programNature,
          itinerary: mergedItinerary,
        },
      };
    }
  }

  return next;
}

export function formHasClientBlobMedia(form: DenaliCreateTourWizardForm): boolean {
  if (hasBlobPhotos(form.photosData?.photos)) {
    return true;
  }
  return (form.programNature.itinerary ?? []).some((day) => hasBlobPhotos(day.photos));
}

/**
 * Remove blob: URLs from wizard snapshots before draft-engine push (blobs are session-local only).
 */
export function stripBlobUrlsFromDenaliDraftPatch(
  formValues: Partial<DenaliCreateTourWizardForm>,
): Partial<DenaliCreateTourWizardForm> {
  const out: Partial<DenaliCreateTourWizardForm> = { ...formValues };

  if (formValues.photosData?.photos != null) {
    const photos = formValues.photosData.photos.filter((p) => !isClientBlobUrl(p.url));
    out.photosData = { photos };
  }

  if (formValues.programNature?.itinerary != null) {
    out.programNature = {
      ...formValues.programNature,
      itinerary: formValues.programNature.itinerary.map((day) => {
        if (day.photos == null || day.photos.length === 0) {
          return day;
        }
        const photos = day.photos.filter((p) => !isClientBlobUrl(p.url));
        return {
          ...day,
          photos: photos.length > 0 ? photos : undefined,
        };
      }),
    };
  }

  return out;
}
