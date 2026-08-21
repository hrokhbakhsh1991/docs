/**
 * Denali booking domain — business policy + HTTP adapters.
 *
 * Ownership:
 * - `booking/`  → domain policy (lifecycle, capacity, validation, adapters)
 * - `bookings/` → operator ops manifest / command-center presentation
 */

export {
  DenaliBookingCapacityPolicyAdapter,
  DenaliBookingEventReactionAdapter,
  DenaliBookingPublicAdapter,
  DenaliBookingValidationPolicyAdapter,
} from "./adapters";

export {
  buildDenaliBookingCreatePolicyContext,
  type BuildDenaliBookingCreatePolicyContextInput,
} from "./build-create-policy-context";

export {
  DEFAULT_DENALI_CAPACITY_RULE,
  type DenaliCapacityRule,
} from "./capacity-rule";

export {
  assertDenaliCreateCapacity,
  assertDenaliTransitionCapacity,
  computeDenaliAvailability,
  denaliWaitlistAllowed,
  evaluateDenaliCreateCapacity,
  type DenaliAvailability,
  type DenaliCreateCapacityDecision,
  type DenaliCreateCapacityEvaluation,
} from "./availability";

export {
  applyDenaliBookingTransition,
  assertCanTransitionDenaliBooking,
  canTransitionDenaliBooking,
  createDenaliBookingPendingSnapshot,
  listDenaliBookingTransitionsFrom,
  type ApplyDenaliBookingTransitionInput,
  type ApplyDenaliBookingTransitionResult,
  type DenaliBookingHistoryEntry,
  type DenaliBookingSnapshot,
  type DenaliBookingTransitionAction,
} from "./lifecycle";

export {
  applyDenaliBookingOpsAction,
  DENALI_BOOKING_OPS_ACTION_KEYS,
  type ApplyDenaliBookingOpsActionInput,
  type DenaliBookingOpsActionKey,
} from "./ops-actions";

export {
  decideDenaliApprove,
  decideDenaliCancel,
  decideDenaliPromoteWaitlist,
  decideDenaliReject,
  decideDenaliWaitlist,
  type DenaliOperatorDecisionMeta,
} from "./operator-decisions";

export {
  denaliPartySizeFromParticipants,
  type DenaliBookingParticipant,
} from "./participant";

export {
  DENALI_BOOKING_STATUS_PIPELINE,
  DENALI_BOOKING_TERMINAL_STATUSES,
  isDenaliBookingStatus,
  isDenaliBookingTerminalStatus,
  type DenaliBookingStatus,
} from "./status";

export { assertDenaliCreateValid } from "./validation";

export {
  applyDenaliRegistrationApprovalFromOperatorFlag,
  denaliRegistrationApprovalFromManualFlag,
  resolveDenaliRegistrationApprovalMode,
  type DenaliRegistrationApprovalMode,
} from "./resolve-denali-registration-approval-mode";

export {
  DENALI_APPROVED_TOUR_HISTORY_SCAN_CAP,
  DENALI_AUTO_APPROVE_MIN_RECENT_TOURS_VALUES,
  denaliGuestQualifiesForRecentTourBypass,
  guestHasApprovedOnEachTour,
  parseDenaliAutoApproveMinRecentTours,
  readDenaliAutoApproveMinRecentToursFromCanonical,
  readDenaliTourStartMs,
  selectLastPublishedTourIds,
  type DenaliAutoApproveMinRecentTours,
} from "./recent-tour-attendance";
