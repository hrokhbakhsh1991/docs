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
  resolveDenaliRegistrationApprovalMode,
  type DenaliRegistrationApprovalMode,
} from "./resolve-denali-registration-approval-mode";

export {
  evaluateDenaliMemberCancellationEligibility,
  type EvaluateDenaliMemberCancellationInput,
  type MemberCancellationEligibility,
  type MemberCancellationMode,
  type MemberCancellationReasonCode,
} from "./member-cancellation-policy";
