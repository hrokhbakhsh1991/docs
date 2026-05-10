import type { TourDto } from "@repo/types";

/**
 * Optional location display fields the API may add later (`TourResponseDto` / list rows).
 * Kept as an intersection so {@link TourDto} stays unchanged at the package boundary.
 */
export type TourWithLocationDisplayV2 = TourDto & {
  displayLocationOverride?: string | null;
  mainDestinationName?: string | null;
  regionName?: string | null;
};

function trimNonEmpty(s: unknown): string | undefined {
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  return t === "" ? undefined : t;
}

/**
 * Unified tour location line for cards and detail views.
 * Prefers explicit override, then destination + region (Persian comma), then legacy `costContext.location`.
 */
export function formatTourLocationV2(tour: TourDto): string {
  const t = tour as TourWithLocationDisplayV2;

  const override = trimNonEmpty(t.displayLocationOverride);
  if (override !== undefined) {
    return override;
  }

  const mainDest = trimNonEmpty(t.mainDestinationName);
  const region = trimNonEmpty(t.regionName);

  if (mainDest !== undefined && region !== undefined) {
    return `${mainDest}، ${region}`;
  }
  if (mainDest !== undefined) return mainDest;
  if (region !== undefined) return region;

  const ctx = tour.costContext;
  if (ctx && typeof ctx === "object") {
    const loc = trimNonEmpty((ctx as Record<string, unknown>).location);
    if (loc !== undefined) {
      return loc;
    }
  }

  return "—";
}
