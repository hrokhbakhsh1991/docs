/**
 * Tour detail page access tiers (BFF `GET /api/tours/:id`).
 * Resolved server-side; clients must not infer from JWT alone.
 */

export const TOUR_DETAIL_ACCESS_LEVEL_VALUES = [
  "OWNER",
  "ADMIN",
  "OPERATIONAL",
  "PURCHASED_USER",
  "GUEST",
] as const;

export type TourDetailAccessLevel = (typeof TOUR_DETAIL_ACCESS_LEVEL_VALUES)[number];

/** Registration statuses that map to {@link TourDetailAccessLevel} `PURCHASED_USER`. */
export const TOUR_DETAIL_PURCHASED_REGISTRATION_STATUSES = ["Accepted", "AcceptedPaid"] as const;

export type TourDetailPurchasedRegistrationStatus =
  (typeof TOUR_DETAIL_PURCHASED_REGISTRATION_STATUSES)[number];

export type TourDetailViewHints = {
  /** When false, exact coordinates and gathering GPS are withheld for PURCHASED_USER. */
  gpsUnlocked: boolean;
  /** ISO timestamp when GPS unlocks (48h before departure by default). */
  gpsUnlockAt?: string | null;
};

const ACCESS_RANK: Record<TourDetailAccessLevel, number> = {
  GUEST: 1,
  PURCHASED_USER: 2,
  OPERATIONAL: 3,
  ADMIN: 4,
  OWNER: 5,
};

export function tourDetailAccessRank(level: TourDetailAccessLevel): number {
  return ACCESS_RANK[level];
}

export function hasMinTourDetailAccess(
  current: TourDetailAccessLevel,
  min: TourDetailAccessLevel | TourDetailAccessLevel[],
): boolean {
  const currentRank = tourDetailAccessRank(current);
  const mins = Array.isArray(min) ? min : [min];
  const required = Math.min(...mins.map((m) => tourDetailAccessRank(m)));
  return currentRank >= required;
}

export function hasFullTourDetailAccess(level: TourDetailAccessLevel): boolean {
  return level === "OWNER" || level === "ADMIN" || level === "OPERATIONAL";
}

export function hasPurchasedTourDetailAccess(level: TourDetailAccessLevel): boolean {
  return hasFullTourDetailAccess(level) || level === "PURCHASED_USER";
}

export function canViewTourDetailChatLink(level: TourDetailAccessLevel): boolean {
  return level === "OWNER" || level === "ADMIN";
}
