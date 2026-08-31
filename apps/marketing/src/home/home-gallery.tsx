import { getTranslations } from "next-intl/server";

import type { HomeGalleryPhoto } from "./derive-home-gallery-photos";
import { HomeGalleryShowcase } from "./home-gallery-showcase";

export type HomeGalleryProps = {
  readonly photos: readonly HomeGalleryPhoto[];
};

export async function HomeGallery({ photos }: HomeGalleryProps) {
  const t = await getTranslations("catalog");

  if (photos.length === 0) {
    return null;
  }

  return (
    <section data-marketing-home-gallery data-marketing-home-gallery-editorial id="gallery">
      <div data-marketing-home-gallery-inner>
        <header>
          <h2>{t("home.full.gallery.title")}</h2>
          <p data-marketing-home-gallery-lead>{t("home.full.gallery.lead")}</p>
        </header>
        <HomeGalleryShowcase
          photos={photos}
          labels={{
            scrollPrev: t("home.full.gallery.scrollPrev"),
            scrollNext: t("home.full.gallery.scrollNext"),
            lightbox: {
              close: t("detail.gallery.lightboxClose"),
              prev: t("detail.gallery.lightboxPrev"),
              next: t("detail.gallery.lightboxNext"),
              // Placeholder index — HomeGalleryShowcase builds per-photo labels client-side.
              openPhoto: t("detail.gallery.openPhoto", { index: 1 }),
            },
          }}
        />
      </div>
    </section>
  );
}
