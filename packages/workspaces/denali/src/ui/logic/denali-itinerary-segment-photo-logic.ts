import type { DenaliTourPhoto } from "./denali-photo-types";

/**
 * Photo `day` on tour photos is a segment-picker hint only.
 * Public catalog egress uses segment.photoIds resolved against photos[].
 */
export const DENALI_ITINERARY_PHOTO_DAY_IS_PICKER_HINT_ONLY = true;

export type DenaliItinerarySelectablePhoto = DenaliTourPhoto & { readonly id: string };

export function filterSelectableItineraryPhotos(
  photos: readonly DenaliTourPhoto[],
  dayNumber?: number
): readonly DenaliItinerarySelectablePhoto[] {
  const withIds = photos.filter(
    (photo): photo is DenaliItinerarySelectablePhoto =>
      typeof photo.id === "string" && photo.id.trim().length > 0
  );
  if (dayNumber == null) {
    return withIds;
  }
  return [...withIds].sort((left, right) => {
    const leftMatches = left.day === dayNumber ? 0 : 1;
    const rightMatches = right.day === dayNumber ? 0 : 1;
    return leftMatches - rightMatches;
  });
}

export function toggleItinerarySegmentPhotoSelection(
  selectedIds: readonly string[],
  photoId: string
): string[] {
  if (selectedIds.includes(photoId)) {
    return selectedIds.filter((id) => id !== photoId);
  }
  return [...selectedIds, photoId];
}

export function readItineraryPhotoLabel(photo: DenaliTourPhoto, fallback: string): string {
  const label = photo.label?.trim();
  return label != null && label.length > 0 ? label : fallback;
}
