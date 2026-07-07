import { getTranslations } from "next-intl/server";

import {
  buildCatalogTourPhotoSet,
  readCatalogTourOverflowGalleryPhotos,
  tourUsesCatalogDetailPhotoFallbacks,
} from "./build-catalog-tour-photo-set";
import { CatalogCoverImage } from "./catalog-cover-image";
import { CatalogTourDetailPhotoLightboxTrigger } from "./catalog-tour-detail-photo-lightbox";
import type { MarketingCatalogCard } from "./catalog-types";

export type CatalogTourDetailGalleryProps = {
  readonly tour: MarketingCatalogCard;
  readonly title: string;
};

/** Overflow grid — hero mosaic shows first 3; rest anchor-linked from "+N more". */
export async function CatalogTourDetailGallery({ tour, title }: CatalogTourDetailGalleryProps) {
  const t = await getTranslations("catalog");
  const photos = buildCatalogTourPhotoSet(tour);
  const overflowPhotos = readCatalogTourOverflowGalleryPhotos(photos);
  const usesFallbackPhotos = tourUsesCatalogDetailPhotoFallbacks(tour);
  if (overflowPhotos.length === 0) {
    return null;
  }
  const heroVisibleCount = photos.length - overflowPhotos.length;

  return (
    <section
      data-marketing-catalog-detail-gallery
      id="catalog-detail-gallery"
      aria-label={t("detail.gallery.heading")}
      {...(usesFallbackPhotos ? { "data-marketing-catalog-detail-gallery-fallback": true } : {})}
    >
      <h2>{t("detail.gallery.heading")}</h2>
      <ul data-marketing-catalog-detail-gallery-grid>
        {overflowPhotos.map((photoUrl, index) => {
          const photoIndex = heroVisibleCount + index;
          return (
            <li key={photoUrl}>
              <CatalogTourDetailPhotoLightboxTrigger
                index={photoIndex}
                ariaLabel={t("detail.gallery.openPhoto", { index: photoIndex + 1 })}
              >
                <CatalogCoverImage
                  src={photoUrl}
                  alt={t("detail.gallery.photoAlt", {
                    title,
                    index: photoIndex + 1,
                  })}
                  width={640}
                  height={427}
                  cover
                />
              </CatalogTourDetailPhotoLightboxTrigger>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
