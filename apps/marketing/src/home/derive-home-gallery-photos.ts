import { MARKETING_GALLERY_STATIC_ITEMS } from "./home-marketing-assets";

export type HomeGalleryPhoto = Readonly<{
  readonly id: string;
  readonly src: string;
  readonly alt: string;
}>;

/** Static showcase photos for landing gallery (no catalog / tour links). */
export function deriveHomeGalleryPhotos(
  translate: (messageKey: string) => string
): readonly HomeGalleryPhoto[] {
  return MARKETING_GALLERY_STATIC_ITEMS.map((item) => ({
    id: item.id,
    src: item.src,
    alt: translate(item.altKey),
  }));
}
