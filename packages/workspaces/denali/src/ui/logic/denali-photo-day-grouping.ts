import type { DenaliTourPhoto } from "./denali-photo-types";

export type DenaliPhotoDayItem = {
  readonly photo: DenaliTourPhoto;
  readonly globalIndex: number;
};

export type DenaliPhotoDaySection = {
  readonly day: number;
  readonly items: readonly DenaliPhotoDayItem[];
};

/** Clamp photo.day to [1, dayCount]; missing/invalid → day 1. */
export function resolveDenaliPhotoDay(photo: DenaliTourPhoto, dayCount: number): number {
  const raw = photo.day;
  if (raw != null && Number.isFinite(raw) && raw >= 1) {
    return Math.min(Math.floor(raw), dayCount);
  }
  return 1;
}

/** Bucket photos by program day while preserving global array index (cover = index 0). */
export function buildDenaliPhotoDaySections(
  photos: readonly DenaliTourPhoto[],
  dayCount: number
): readonly DenaliPhotoDaySection[] {
  const buckets = new Map<number, DenaliPhotoDayItem[]>();
  for (let day = 1; day <= dayCount; day += 1) {
    buckets.set(day, []);
  }

  photos.forEach((photo, globalIndex) => {
    const day = resolveDenaliPhotoDay(photo, dayCount);
    buckets.get(day)?.push({ photo, globalIndex });
  });

  return Array.from({ length: dayCount }, (_, index) => ({
    day: index + 1,
    items: buckets.get(index + 1) ?? [],
  }));
}

/**
 * Collapse long multi-day tours by default: ≤3 days all open; 4+ only day 1 open.
 * Days with photos stay discoverable via summary count.
 */
export function shouldDenaliPhotoDayDefaultOpen(day: number, dayCount: number): boolean {
  if (dayCount <= 3) {
    return true;
  }
  return day === 1;
}

/** Responsive grid column contract for photo thumbnails inside a day section. */
export function readDenaliPhotoGridColumnCount(viewportWidth: number): 1 | 2 | 3 {
  if (viewportWidth >= 1024) {
    return 3;
  }
  if (viewportWidth >= 640) {
    return 2;
  }
  return 1;
}
