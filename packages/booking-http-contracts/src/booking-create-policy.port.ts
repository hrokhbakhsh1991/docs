/**
 * Workspace booking create policies — executable ports (not registration tokens).
 * Host supplies occupancy; workspaces own accept/reject rules.
 */

/** Context for validation + capacity at public create time. */
export type BookingCreatePolicyContext = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly guestEmail?: string;
  readonly guestPhone?: string;
  readonly partySize: number;
  readonly departureAt: string;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
  /** Approved party-size already on this tour (host/repository). */
  readonly occupiedApprovedPartySize: number;
  /**
   * Tour capacity ceiling when known.
   * `null` = unknown — Denali treats as unlimited; workspaces may still apply markers.
   */
  readonly tourCapacityMax: number | null;
};

/**
 * Policy probe label — Denali accepts; booking-ws2 capacity rejects.
 * Used for multi-workspace behavioral proof (same process, different workspaceType).
 */
export const BOOKING_POLICY_CASE_A_GUEST_LABEL = "CASE_A";

export type BookingValidationPolicyPort = {
  readonly kind: string;
  assertCreateValid(ctx: BookingCreatePolicyContext): void;
};

export type BookingCapacityPolicyPort = {
  readonly kind: string;
  assertCreateCapacity(ctx: BookingCreatePolicyContext): void;
};

/** Registration marker for public-booking capability — gated on public create path. */
export type BookingPublicCapabilityPort = {
  readonly kind: string;
  /** True when this workspace allows public guest create. */
  supportsPublicCreate(): boolean;
};
