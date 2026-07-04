import type { HomeDestinationId } from "./home-destination-ids";

/** Default tour card cover when catalog has no photos (PR-9). */
export const MARKETING_FALLBACK_TOUR_COVER_PATH = "/home/fallback-tour-cover.webp";

/** Static destination hero photos — CSS + optional img fallback (PR-9). */
export const MARKETING_DESTINATION_IMAGE_PATHS: Readonly<
  Record<HomeDestinationId, string>
> = {
  alborz: "/home/destinations/alborz.webp",
  damavand: "/home/destinations/damavand.webp",
  zardkuh: "/home/destinations/zardkooh.webp",
};

/** Gallery masonry fallbacks when published tours lack cover URLs (PR-9). */
export const MARKETING_GALLERY_FALLBACK_PATHS = [
  "/home/gallery/01.webp",
  "/home/gallery/02.webp",
  "/home/gallery/03.webp",
] as const;

export const MARKETING_GALLERY_FALLBACK_MIN = 3;
