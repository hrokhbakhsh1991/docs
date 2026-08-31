/**
 * AUTO-GENERATED-style bridge — sole apps/api import surface for Denali host modules
 * not yet absorbed into workspace registry codegen (export-surface P2 migration).
 * @see docs/dev/denali-plugin-encapsulation.mdoc
 */

export {
  parseOperationalRosterListQuery,
  composeTourOperationalRosterRow,
  filterOperationalRosterRows,
  type OperationalRosterListQuery,
  type OperationalRosterListResponse,
} from "@app-tour/workspace-denali/host/roster";

export { assertDenaliWorkspaceOwner } from "@app-tour/workspace-denali/host/workspace-owner";

export {
  DenaliTourMutationBlockedError,
  DenaliTourMutationOverrideRequiredError,
  isDenaliTourMutationBlockedError,
  isDenaliTourMutationOverrideRequiredError,
} from "@app-tour/workspace-denali/host/errors/tour-mutation";

export {
  evaluateDenaliTourMutation,
  readDenaliTransportAllocationsLocked,
  type DenaliTourMutationDecision,
  type DenaliTourMutationSideEffect,
  type DenaliTourOperationalFacts,
} from "@app-tour/workspace-denali/host/tours";

export {
  evaluateDenaliMemberCancellationEligibility,
  computeDenaliRefundEligibility,
} from "@app-tour/workspace-denali/host/booking";

export {
  computeDenaliPaymentDueAt,
  resolveDenaliPaymentDeadlineHours,
} from "@app-tour/workspace-denali/host/finance";

export {
  assertDriverSettlementTransition,
  buildSettlementIdempotencyKey,
  calculateDriverSettlement,
  type DriverSettlement,
  type DriverSettlementAuditEvent,
} from "@app-tour/workspace-denali/host/settlement";

export {
  countAssignedPassengers,
  validateTransportAllocations,
  type RosterParticipant,
  type TransportAllocation,
  type TransportAllocationInput,
} from "@app-tour/workspace-denali/host/transport";

export { createDenaliTourWorkspacePolicyValidator } from "@app-tour/workspace-denali/host/policy/tour-policy";
