import Link from "next/link";
import { getTranslations } from "next-intl/server";

import {
  buildCatalogTourPhotoSet,
  readCatalogTourHeroGalleryPhotos,
  tourUsesCatalogDetailPhotoFallbacks,
} from "./build-catalog-tour-photo-set";
import { CatalogCoverImage } from "./catalog-cover-image";
import type { MarketingCatalogCard } from "./catalog-types";

export type CatalogTourDetailHeroGalleryProps = {
  readonly tour: MarketingCatalogCard;
  readonly title: string;
};

function resolveHeroGalleryLayout(
  count: number,
): "single" | "duo" | "mosaic" {
  if (count <= 1) {
    return "single";
  }
  if (count === 2) {
    return "duo";
  }
  return "mosaic";
}

export async function CatalogTourDetailHeroGallery({
  tour,
  title,
}: CatalogTourDetailHeroGalleryProps) {
  const t = await getTranslations("catalog");
  const photos = buildCatalogTourPhotoSet(tour);
  const usesFallbackPhotos = tourUsesCatalogDetailPhotoFallbacks(tour);
  if (photos.length === 0) {
    return null;
  }

  const heroPhotos = readCatalogTourHeroGalleryPhotos(photos);
  const [primaryUrl, ...supportingUrls] = heroPhotos;
  const overflowCount = photos.length - heroPhotos.length;
  const layout = resolveHeroGalleryLayout(heroPhotos.length);
  const formatPhotoAlt = (index: number) =>
    t("detail.gallery.photoAlt", { title, index: index + 1 });

  return (
    <div
      data-marketing-catalog-detail-hero
      data-marketing-catalog-detail-hero-gallery
      data-marketing-catalog-detail-hero-gallery-layout={layout}
      {...(overflowCount > 0
        ? { "data-marketing-catalog-detail-hero-has-overflow": true }
        : {})}
      {...(usesFallbackPhotos
        ? { "data-marketing-catalog-detail-gallery-fallback": true }
        : {})}
    >
      <figure
        data-marketing-catalog-detail-cover
        data-marketing-catalog-detail-hero-gallery-primary
      >
        <CatalogCoverImage
          src={primaryUrl}
          alt={formatPhotoAlt(0)}
          width={1280}
          height={720}
          cover
          priority
        />
      </figure>

      {supportingUrls.length > 0 ? (
        <div data-marketing-catalog-detail-hero-gallery-support>
          {supportingUrls.map((photoUrl, index) => {
            const photoIndex = index + 1;
            const isLastVisible = index === supportingUrls.length - 1;
            const showMoreOverlay = overflowCount > 0 && isLastVisible;

            return (
              <figure
                key={photoUrl}
                data-marketing-catalog-detail-hero-gallery-item
                {...(showMoreOverlay
                  ? { "data-marketing-catalog-detail-hero-gallery-more-cell": true }
                  : {})}
              >
                <CatalogCoverImage
                  src={photoUrl}
                  alt={formatPhotoAlt(photoIndex)}
                  width={640}
                  height={480}
                  cover
                />
                {showMoreOverlay ? (
                  <Link
                    href="#catalog-detail-gallery"
                    data-marketing-catalog-detail-gallery-more
                  >
                    {t("detail.gallery.morePhotos", { count: overflowCount })}
                  </Link>
                ) : null}
              </figure>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
