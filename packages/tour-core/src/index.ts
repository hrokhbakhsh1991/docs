/**
 * @app-tour/tour-core — shared tour pure rules (CW-S1) + neutral orchestration ports (CW-5).
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

export {
  readCapacityAtPath,
  type CanonicalCapacityPath,
  type CapacityDefinitionPort,
} from "./capacity/capacity-definition.port";

export {
  sumOccupyingSeatsForStatus,
  type OccupancyPort,
  type OccupancyRow,
} from "./capacity/occupancy.port";

export { readFiniteCapacityNumber } from "./capacity/read-finite-capacity";

export {
  mergeShallowCanonicalPatchData,
  type CanonicalPatchData,
} from "./canonical/canonical-patch-merge";

export {
  assertWorkspaceRegistrationContactBasics,
  assertWorkspaceTypeOrThrow,
  createTourDepartureNotSetValidationError,
  createTourNotPublishedValidationError,
  loadWorkspaceTourIfPublished,
  normalizeWorkspaceTypeKey,
  readWorkspaceCanonicalCapacityByPath,
  requireWorkspacePublishedTour,
  WORKSPACE_REGISTRATION_EMAIL_PATTERN,
  WORKSPACE_REGISTRATION_PHONE_PATTERN,
  type AssertWorkspaceRegistrationContactBasicsParams,
  type ReadonlyCanonicalShape,
  type WorkspacePublishedTourLoadParams,
} from "./registration/registration-guards";

export {
  BOOKING_REGISTRATION_MODEL,
  registrationAwaitingOperatorDecision,
  registrationOccupiesSeat,
  registrationQueuedWithoutSeat,
  registrationTerminalNegative,
  registrationVoided,
  URBAN_REGISTRATION_MODEL,
  type RegistrationCapacityStrategy,
  type RegistrationLifecycleProfile,
  type RegistrationModelContract,
} from "./registration/registration-model.contract";

export {
  mapPublishLabelToVisibilityBucket,
  type TourPublishVisibilityBucket,
  type WorkspacePublishLabelMapping,
} from "./publish/publish-label-mapping";

export {
  detectTourPublishTransition,
  type TourPublishTransition,
} from "./publish/publish-transition";

export type {
  TourPublishVisibilityBinding,
  TourPublishVisibilityPort,
  TourPublishVisibilityPredicate,
} from "./publish/publish-visibility.port";

export {
  assertCanTransitionState,
  canTransitionState,
  isTerminalTransitionStatus,
  listTransitionSourcesForTarget,
  listTransitionTargetsFrom,
  type TransitionTable,
} from "./transition/transition-table";

export {
  BOOKING_TRANSITION_TABLE,
  assertCanTransitionBookingViaGenericTable,
  canTransitionBookingViaGenericTable,
  listBookingTransitionSourcesForTarget,
  listBookingTransitionTargetsFrom,
} from "./transition/booking-lifecycle-consumer";

export const TOUR_CORE_PACKAGE_MARKER = "tour-core" as const;
