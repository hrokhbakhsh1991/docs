import { MARKETING_FALLBACK_TOUR_COVER_PATH } from "./home-marketing-assets";

/** Tour cover for home cards — never returns empty (PR-9 placeholder). */
export function resolveHomeTourCoverUrl(
  coverImageUrl: string | null | undefined
): string {
  const trimmed = coverImageUrl?.trim();
  if (trimmed != null && trimmed.length > 0) {
    return trimmed;
  }
  return MARKETING_FALLBACK_TOUR_COVER_PATH;
}
