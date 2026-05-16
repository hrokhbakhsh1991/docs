/**
 * Authoritative tour lifecycle transition matrix (Phase 17.2).
 * Product "PUBLISH" maps to `DRAFT → OPEN`; there is no separate Published status.
 */

export const TOUR_LIFECYCLE_STATUSES = ["DRAFT", "OPEN", "CLOSED", "CANCELLED"] as const;
export type TourLifecycleStatusValue = (typeof TOUR_LIFECYCLE_STATUSES)[number];

export type TourLifecycleTransitionRule = {
  readonly from: TourLifecycleStatusValue;
  readonly to: TourLifecycleStatusValue;
  readonly allowed: boolean;
};

export const TOUR_LIFECYCLE_TRANSITION_MATRIX: readonly TourLifecycleTransitionRule[] = [
  { from: "DRAFT", to: "OPEN", allowed: true },
  { from: "DRAFT", to: "CANCELLED", allowed: true },
  { from: "OPEN", to: "CLOSED", allowed: true },
  { from: "OPEN", to: "CANCELLED", allowed: true },
  { from: "CLOSED", to: "CANCELLED", allowed: true },
  { from: "OPEN", to: "DRAFT", allowed: false },
  { from: "CLOSED", to: "OPEN", allowed: false },
  { from: "CLOSED", to: "DRAFT", allowed: false },
  { from: "CANCELLED", to: "DRAFT", allowed: false },
  { from: "CANCELLED", to: "OPEN", allowed: false },
] as const;

export function isTourLifecycleTransitionAllowed(
  from: TourLifecycleStatusValue,
  to: TourLifecycleStatusValue,
): boolean {
  if (from === to) {
    return true;
  }
  return TOUR_LIFECYCLE_TRANSITION_MATRIX.some(
    (rule) => rule.from === from && rule.to === to && rule.allowed,
  );
}
