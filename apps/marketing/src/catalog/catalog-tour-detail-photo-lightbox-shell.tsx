import { getTranslations } from "next-intl/server";

import type { ReactNode } from "react";

import { buildCatalogTourPhotoItems } from "./build-catalog-tour-photo-items";
import { CatalogTourDetailPhotoLightbox } from "./catalog-tour-detail-photo-lightbox";
import type { MarketingCatalogCard } from "./catalog-types";

export type CatalogTourDetailPhotoLightboxShellProps = Readonly<{
  readonly tour: MarketingCatalogCard;
  readonly title: string;
  readonly children: ReactNode;
}>;

/** RSC shell — builds photo list + i18n labels for the client lightbox (PR-D6b). */
export async function CatalogTourDetailPhotoLightboxShell({
  tour,
  title,
  children,
}: CatalogTourDetailPhotoLightboxShellProps) {
  const t = await getTranslations("catalog");
  const photos = buildCatalogTourPhotoItems(tour, (index) =>
    t("detail.gallery.photoAlt", { title, index })
  );

  if (photos.length === 0) {
    return children;
  }

  return (
    <CatalogTourDetailPhotoLightbox
      photos={photos}
      labels={{
        close: t("detail.gallery.lightboxClose"),
        prev: t("detail.gallery.lightboxPrev"),
        next: t("detail.gallery.lightboxNext"),
        // Placeholder index — triggers pass per-photo aria labels at render time.
        openPhoto: t("detail.gallery.openPhoto", { index: 1 }),
        // Note: counter is formatted client-side via string replacement.
        counter: t.raw("detail.gallery.lightboxCounter"),
      }}
    >
      {children}
    </CatalogTourDetailPhotoLightbox>
  );
}
