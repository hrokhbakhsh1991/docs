import {
  MARKETING_FALLBACK_TOUR_COVER_PATH,
  MARKETING_GALLERY_FALLBACK_PATHS,
} from "../home/home-marketing-assets";
import { resolveMarketingCatalogPhotoUrl } from "../home/resolve-home-tour-cover-url";

import type { MarketingCatalogCard } from "./catalog-types";

/** Hero mosaic (3) + at least one overflow tile — pad with PR-9 static assets when API sparse. */
export const CATALOG_TOUR_DETAIL_GALLERY_MIN = 4;

const DETAIL_GALLERY_FALLBACK_PATHS = [
  MARKETING_FALLBACK_TOUR_COVER_PATH,
  ...MARKETING_GALLERY_FALLBACK_PATHS,
] as const;

function collectTourApiPhotoUrls(tour: MarketingCatalogCard): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const add = (value: string | null | undefined): void => {
    const resolved = resolveMarketingCatalogPhotoUrl(value);
    if (resolved == null || seen.has(resolved)) {
      return;
    }
    seen.add(resolved);
    urls.push(resolved);
  };

  add(tour.coverImageUrl);
  for (const url of tour.photoUrls ?? []) {
    add(url);
  }

  return urls;
}

/** True when detail gallery pads with `/home/*` marketing assets (no API photos or too few). */
export function tourUsesCatalogDetailPhotoFallbacks(tour: MarketingCatalogCard): boolean {
  return collectTourApiPhotoUrls(tour).length < CATALOG_TOUR_DETAIL_GALLERY_MIN;
}

/** Deduped tour photos — API first, then PR-9 static fallbacks when sparse (PR-D6). */
export function buildCatalogTourPhotoSet(tour: MarketingCatalogCard): readonly string[] {
  const urls = collectTourApiPhotoUrls(tour);
  const seen = new Set(urls);

  if (urls.length >= CATALOG_TOUR_DETAIL_GALLERY_MIN) {
    return Object.freeze(urls);
  }

  for (const path of DETAIL_GALLERY_FALLBACK_PATHS) {
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);
    urls.push(path);
    if (urls.length >= CATALOG_TOUR_DETAIL_GALLERY_MIN) {
      break;
    }
  }

  if (urls.length === 0) {
    return Object.freeze([MARKETING_FALLBACK_TOUR_COVER_PATH]);
  }

  return Object.freeze(urls);
}

export const CATALOG_TOUR_HERO_GALLERY_VISIBLE_COUNT = 3;

export function readCatalogTourHeroGalleryPhotos(
  photos: readonly string[],
): readonly string[] {
  return photos.slice(0, CATALOG_TOUR_HERO_GALLERY_VISIBLE_COUNT);
}

export function readCatalogTourOverflowGalleryPhotos(
  photos: readonly string[],
): readonly string[] {
  return photos.slice(CATALOG_TOUR_HERO_GALLERY_VISIBLE_COUNT);
}

export function tourHasOverflowGalleryPhotos(tour: MarketingCatalogCard): boolean {
  return readCatalogTourOverflowGalleryPhotos(buildCatalogTourPhotoSet(tour)).length > 0;
}
