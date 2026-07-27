/**
 * Denali capacity / waitlist product policy (booking-owned).
 * Host still supplies occupancy via BookingCreatePolicyContext; Denali owns rules.
 */

export type DenaliCapacityRule = {
  /** Maximum party size allowed on a single booking create. */
  readonly maxPartySize: number;
  /**
   * When true, operators may transition pending → waitlisted (ops promote path).
   * Create-time HTTP capacity still accept/deny only (host always creates as pending).
   */
  readonly waitlistEnabled: boolean;
  /**
   * When true, approve/promote may exceed tourCapacityMax (not used on create).
   * Default false — fail closed.
   */
  readonly overbookAllowed: boolean;
};

/** Default Denali product policy for Phase 1. */
export const DEFAULT_DENALI_CAPACITY_RULE: DenaliCapacityRule = Object.freeze({
  maxPartySize: 20,
  waitlistEnabled: true,
  overbookAllowed: false,
});
