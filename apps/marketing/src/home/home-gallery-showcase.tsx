"use client";

import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { CatalogCoverImage } from "@/catalog/catalog-cover-image";
import {
  CatalogTourDetailPhotoLightbox,
  CatalogTourDetailPhotoLightboxTrigger,
  type CatalogTourDetailPhotoLightboxLabels,
} from "@/catalog/catalog-tour-detail-photo-lightbox";

import { useCallback, useState } from "react";

import type { HomeGalleryPhoto } from "./derive-home-gallery-photos";
import { HomeGalleryFilmstrip } from "./home-gallery-filmstrip";

export type HomeGalleryShowcaseLabels = Readonly<{
  readonly scrollPrev: string;
  readonly scrollNext: string;
  readonly lightbox: CatalogTourDetailPhotoLightboxLabels;
}>;

export type HomeGalleryShowcaseProps = Readonly<{
  readonly photos: readonly HomeGalleryPhoto[];
  readonly labels: HomeGalleryShowcaseLabels;
}>;

const MAX_FILMSTRIP_PHOTOS = 5;

export function HomeGalleryShowcase({ photos, labels }: HomeGalleryShowcaseProps) {
  const t = useTranslations("catalog");
  const [activeIndex, setActiveIndex] = useState(0);

  const clampedIndex = Math.min(Math.max(activeIndex, 0), Math.max(photos.length - 1, 0));
  const activePhoto = photos[clampedIndex];
  const filmstripPhotos = photos
    .filter((_, index) => index !== clampedIndex)
    .slice(0, MAX_FILMSTRIP_PHOTOS);

  const lightboxPhotos = photos.map((photo) => ({
    src: photo.src,
    alt: photo.alt,
  }));

  const showPrevious = useCallback(() => {
    setActiveIndex((current) => (current - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const showNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % photos.length);
  }, [photos.length]);

  if (activePhoto == null) {
    return null;
  }

  const openPhotoLabel = t("home.full.gallery.openPhoto", { index: clampedIndex + 1 });

  return (
    <CatalogTourDetailPhotoLightbox photos={lightboxPhotos} labels={labels.lightbox}>
      <div data-marketing-home-gallery-grid>
        <figure data-marketing-home-gallery-item data-marketing-home-gallery-item-primary>
          <div data-marketing-home-gallery-hero-controls>
            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  data-marketing-home-gallery-hero-prev
                  aria-label={labels.scrollPrev}
                  onClick={showPrevious}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-marketing-home-gallery-hero-next
                  aria-label={labels.scrollNext}
                  onClick={showNext}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </>
            ) : null}
            <CatalogTourDetailPhotoLightboxTrigger
              index={clampedIndex}
              ariaLabel={openPhotoLabel}
              overlay
            >
              <CatalogCoverImage
                src={activePhoto.src}
                alt={activePhoto.alt}
                width={1280}
                height={548}
                cover
              />
              <span data-marketing-home-gallery-zoom-hint aria-hidden="true">
                <ZoomIn />
              </span>
            </CatalogTourDetailPhotoLightboxTrigger>
          </div>
          <figcaption data-marketing-home-gallery-caption>
            <span data-marketing-home-gallery-caption-title>{activePhoto.alt}</span>
          </figcaption>
        </figure>

        {filmstripPhotos.length > 0 ? (
          <HomeGalleryFilmstrip prevLabel={labels.scrollPrev} nextLabel={labels.scrollNext}>
            {filmstripPhotos.map((photo) => {
              const photoIndex = photos.findIndex((entry) => entry.id === photo.id);
              return (
                <figure
                  key={photo.id}
                  data-marketing-home-gallery-item
                  data-marketing-home-gallery-item-active={
                    photoIndex === clampedIndex ? "true" : "false"
                  }
                >
                  <button
                    type="button"
                    data-marketing-home-gallery-thumb
                    aria-label={photo.alt}
                    aria-current={photoIndex === clampedIndex ? "true" : undefined}
                    onClick={() => setActiveIndex(photoIndex)}
                  >
                    <CatalogCoverImage src={photo.src} alt="" width={480} height={360} cover />
                  </button>
                </figure>
              );
            })}
          </HomeGalleryFilmstrip>
        ) : null}
      </div>
    </CatalogTourDetailPhotoLightbox>
  );
}
