import type { PublicCatalogItinerarySegment } from "@app-tour/workspace-sdk";

import { resolveMarketingCatalogPhotoUrl } from "@/home/resolve-home-tour-cover-url";
import type { AppLocale } from "@/i18n/routing";
import { toLocalizedDigits } from "@/i18n/format-localized-digits";

export function formatCatalogItinerarySegmentLine(
  segment: PublicCatalogItinerarySegment,
  locale: AppLocale = "fa"
): string {
  const line = [segment.startTime, segment.title, segment.locationLabel]
    .filter((part) => part != null && part.length > 0)
    .join(" — ");
  return toLocalizedDigits(line, locale);
}

export function readCatalogItinerarySegmentPhotoUrls(
  segment: PublicCatalogItinerarySegment
): readonly string[] {
  const urls = segment.photoUrls;
  if (urls == null || urls.length === 0) {
    return [];
  }
  const reachable: string[] = [];
  for (const url of urls) {
    const resolved = resolveMarketingCatalogPhotoUrl(url);
    if (resolved != null) {
      reachable.push(resolved);
    }
  }
  return reachable;
}
