/**
 * PR14-A — Command Bridge failure taxonomy.
 * Failures never create Case state or Case rollback.
 */

export type CaseCommandBridgeFailureCode =
  | "auth_denied"
  | "vocabulary_denied"
  | "sot_rejected"
  | "concurrency_conflict"
  | "provider_unavailable"
  | "intent_invalid"
  | "reexecute_failed";

export const CASE_COMMAND_BRIDGE_FAILURE_CODES = [
  "auth_denied",
  "vocabulary_denied",
  "sot_rejected",
  "concurrency_conflict",
  "provider_unavailable",
  "intent_invalid",
  "reexecute_failed",
] as const satisfies readonly CaseCommandBridgeFailureCode[];

/**
 * Legacy PR9-B reason aliases → PR14-A canonical codes.
 * Kept for audit continuity in Host logs.
 */
export function normalizeBridgeFailureReason(
  reason: string
): CaseCommandBridgeFailureCode | string {
  switch (reason) {
    case "authz_denied":
      return "auth_denied";
    case "vocabulary_rejected":
      return "vocabulary_denied";
    default:
      return reason;
  }
}
