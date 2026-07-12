/** Default tour card cover when catalog has no photos (PR-9). */
export const MARKETING_FALLBACK_TOUR_COVER_PATH = "/home/fallback-tour-cover.webp";

/** Static landing gallery — operator upload deferred; marketing-only showcase (PR-23). */
export const MARKETING_GALLERY_STATIC_ITEMS = [
  { id: "gallery-01", src: "/home/gallery/01.webp", altKey: "home.full.gallery.photos.01" },
  { id: "gallery-02", src: "/home/gallery/02.webp", altKey: "home.full.gallery.photos.02" },
  { id: "gallery-03", src: "/home/gallery/03.webp", altKey: "home.full.gallery.photos.03" },
] as const;

/** @deprecated Use MARKETING_GALLERY_STATIC_ITEMS — kept for legacy guards. */
export const MARKETING_GALLERY_FALLBACK_PATHS = MARKETING_GALLERY_STATIC_ITEMS.map(
  (item) => item.src
);

export const MARKETING_GALLERY_FALLBACK_MIN = 3;
