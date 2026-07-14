import { MARKETING_FALLBACK_TOUR_COVER_PATH } from "./home-marketing-assets";

/** Reserved / dev-only hosts that must not render in marketing UI. */
export function isUnreachableMarketingCatalogImageUrl(url: string): boolean {
  if (url.startsWith("/")) {
    return false;
  }
  try {
    const { hostname } = new URL(url);
    const normalized = hostname.toLowerCase();
    return normalized === "cdn.example" || normalized.endsWith(".example");
  } catch {
    return true;
  }
}

/** Normalize a catalog photo URL — null when empty or unreachable smoke placeholder. */
export function resolveMarketingCatalogPhotoUrl(
  url: string | null | undefined
): string | null {
  const trimmed = url?.trim();
  if (trimmed == null || trimmed.length === 0) {
    return null;
  }
  if (isUnreachableMarketingCatalogImageUrl(trimmed)) {
    return null;
  }
  return trimmed;
}

/** Tour cover for home + catalog cards — never returns empty or unreachable smoke URL (PR-9). */
export function resolveHomeTourCoverUrl(
  coverImageUrl: string | null | undefined
): string {
  const resolved = resolveMarketingCatalogPhotoUrl(coverImageUrl);
  return resolved ?? MARKETING_FALLBACK_TOUR_COVER_PATH;
}
