import { getTranslations } from "next-intl/server";

import type { HomeGalleryPhoto } from "./derive-home-gallery-photos";
import { HomeGalleryShowcase } from "./home-gallery-showcase";
import { HomeSectionViewAllLink } from "./home-section-view-all-link";

export type HomeGalleryProps = {
  readonly photos: readonly HomeGalleryPhoto[];
};

export async function HomeGallery({ photos }: HomeGalleryProps) {
  const t = await getTranslations("catalog");

  if (photos.length === 0) {
    return null;
  }

  return (
    <section data-marketing-home-gallery id="gallery">
      <header>
        <div data-marketing-home-section-header-row data-marketing-home-gallery-header-row>
          <h2>{t("home.full.gallery.title")}</h2>
          <HomeSectionViewAllLink data-marketing-home-gallery-view-all>
            {t("home.full.gallery.browseAll")}
          </HomeSectionViewAllLink>
        </div>
        <p data-marketing-home-gallery-lead>{t("home.full.gallery.lead")}</p>
      </header>
      <HomeGalleryShowcase
        photos={photos}
        labels={{
          scrollPrev: t("home.full.gallery.scrollPrev"),
          scrollNext: t("home.full.gallery.scrollNext"),
          openPhoto: t("home.full.gallery.openPhoto"),
          lightbox: {
            close: t("detail.gallery.lightboxClose"),
            prev: t("detail.gallery.lightboxPrev"),
            next: t("detail.gallery.lightboxNext"),
            openPhoto: t("detail.gallery.openPhoto"),
            counter: t("detail.gallery.lightboxCounter"),
          },
        }}
      />
    </section>
  );
}
