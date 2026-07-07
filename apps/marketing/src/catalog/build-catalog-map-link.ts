import type { PublicCatalogGatheringPoint } from "@app-tour/workspace-sdk";

/** External map link for gathering coordinates (OSM). */
export function buildCatalogMapLink(
  point: PublicCatalogGatheringPoint | null | undefined,
): string | null {
  const latitude = point?.latitude;
  const longitude = point?.longitude;
  if (
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`;
}
