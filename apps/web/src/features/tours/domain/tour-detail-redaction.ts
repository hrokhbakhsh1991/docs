import type { TourDetailViewHints } from "@repo/types";

export { buildTourDetailViewForAccess } from "@/lib/tours/tour-detail-redaction";

/** Default view hints for anonymous public tour detail (no GPS unlock). */
export const GUEST_HINTS: TourDetailViewHints = {
  gpsUnlocked: false,
  gpsUnlockAt: null,
};
