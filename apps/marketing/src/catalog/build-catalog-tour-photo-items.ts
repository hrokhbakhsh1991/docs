import { buildCatalogTourPhotoSet } from "./build-catalog-tour-photo-set";
import type { MarketingCatalogCard } from "./catalog-types";

export type CatalogTourPhotoItem = Readonly<{
  readonly src: string;
  readonly alt: string;
}>;

/** Ordered photo items for hero, overflow grid, and lightbox (1-based alt index). */
export function buildCatalogTourPhotoItems(
  tour: MarketingCatalogCard,
  formatAlt: (index: number) => string
): readonly CatalogTourPhotoItem[] {
  return Object.freeze(
    buildCatalogTourPhotoSet(tour).map((src, zeroBasedIndex) => ({
      src,
      alt: formatAlt(zeroBasedIndex + 1),
    }))
  );
}
