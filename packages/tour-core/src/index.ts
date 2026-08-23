/**
 * @app-tour/tour-core — shared tour pure rules (CW-S1).
 * DEC-CW-07: workspace-sdk → tour-core → booking-http-contracts only.
 */

export {
  computeSpotsRemaining,
  withSpotsRemaining,
} from "./capacity/spots-remaining";

export {
  atCreateCapacityStrategy,
  resolveRegistrationCapacityDecision,
  sumAcceptedRegistrationSeats,
} from "./capacity/at-create-strategy";

export type {
  AtCreateCapacityDecision,
  AtCreateCapacityInput,
  AtCreateCapacityPolicy,
} from "./capacity/at-create-strategy";

export const TOUR_CORE_PACKAGE_MARKER = "tour-core" as const;
