import type { MarketingCatalogCard } from "@/catalog/catalog-types";

import {
  MARKETING_GALLERY_FALLBACK_MIN,
  MARKETING_GALLERY_FALLBACK_PATHS,
} from "./home-marketing-assets";

export type HomeGalleryPhoto = Readonly<{
  readonly tourId: string;
  readonly src: string;
  readonly alt: string;
  /** When true, link targets `/tours` instead of tour detail. */
  readonly browseFallback?: boolean;
}>;

const MAX_GALLERY_PHOTOS = 8;

/** Unique tour cover URLs for home gallery masonry (PR-8 + PR-9 static fallbacks). */
export function deriveHomeGalleryPhotos(
  items: readonly MarketingCatalogCard[],
  defaultAlt: string
): readonly HomeGalleryPhoto[] {
  const seen = new Set<string>();
  const photos: HomeGalleryPhoto[] = [];

  for (const item of items) {
    const src = item.coverImageUrl?.trim();
    if (src == null || src.length === 0 || seen.has(src)) {
      continue;
    }
    seen.add(src);
    photos.push({
      tourId: item.id,
      src,
      alt: item.title?.trim() || defaultAlt,
    });
    if (photos.length >= MAX_GALLERY_PHOTOS) {
      break;
    }
  }

  if (photos.length < MARKETING_GALLERY_FALLBACK_MIN) {
    const fallbackTourId = items[0]?.id ?? "browse";
    const browseFallback = items.length === 0;
    for (const src of MARKETING_GALLERY_FALLBACK_PATHS) {
      if (photos.length >= MAX_GALLERY_PHOTOS) {
        break;
      }
      if (seen.has(src)) {
        continue;
      }
      seen.add(src);
      photos.push({
        tourId: fallbackTourId,
        src,
        alt: defaultAlt,
        ...(browseFallback ? { browseFallback: true } : {}),
      });
    }
  }

  return photos;
}
