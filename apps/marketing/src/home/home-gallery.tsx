import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CatalogCoverImage } from "@/catalog/catalog-cover-image";

import type { HomeGalleryPhoto } from "./derive-home-gallery-photos";

export type HomeGalleryProps = {
  readonly photos: readonly HomeGalleryPhoto[];
};

export async function HomeGallery({ photos }: HomeGalleryProps) {
  const t = await getTranslations("catalog");

  if (photos.length === 0) {
    return null;
  }

  const [primaryPhoto, ...supportingPhotos] = photos;

  const renderPhotoCell = (photo: HomeGalleryPhoto) => {
    const href = photo.browseFallback ? "/tours" : `/tours/${photo.tourId}`;
    const viewLabel = photo.browseFallback
      ? t("home.full.gallery.browseAll")
      : t("home.full.gallery.viewTour");

    return (
      <>
        <Link href={href} data-marketing-home-gallery-link>
          <CatalogCoverImage
            src={photo.src}
            alt={photo.alt}
            width={480}
            height={360}
            cover
          />
        </Link>
        <figcaption data-marketing-home-gallery-caption>
          <span data-marketing-home-gallery-caption-title>{photo.alt}</span>
          <span data-marketing-home-gallery-caption-action>{viewLabel}</span>
        </figcaption>
      </>
    );
  };

  return (
    <section data-marketing-home-gallery>
      <header>
        <h2>{t("home.full.gallery.title")}</h2>
        <p>{t("home.full.gallery.lead")}</p>
      </header>
      <div data-marketing-home-gallery-grid>
        <figure
          data-marketing-home-gallery-item
          data-marketing-home-gallery-item-primary
        >
          {renderPhotoCell(primaryPhoto)}
        </figure>
        {supportingPhotos.length > 0 ? (
          <div data-marketing-home-gallery-support>
            {supportingPhotos.map((photo) => (
              <figure
                key={`${photo.tourId}:${photo.src}`}
                data-marketing-home-gallery-item
              >
                {renderPhotoCell(photo)}
              </figure>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
