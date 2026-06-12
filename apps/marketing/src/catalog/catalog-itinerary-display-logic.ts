import type { PublicCatalogItinerarySegment } from "@app-tour/workspace-sdk";

export function formatCatalogItinerarySegmentLine(
  segment: PublicCatalogItinerarySegment
): string {
  return [segment.startTime, segment.title, segment.locationLabel]
    .filter((part) => part != null && part.length > 0)
    .join(" — ");
}

export function readCatalogItinerarySegmentPhotoUrls(
  segment: PublicCatalogItinerarySegment
): readonly string[] {
  const urls = segment.photoUrls;
  if (urls == null || urls.length === 0) {
    return [];
  }
  return urls.filter((url) => url.trim().length > 0);
}
