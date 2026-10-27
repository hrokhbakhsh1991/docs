/**
 * Workspace booking create policies — executable ports (not registration tokens).
 * Host supplies occupancy; workspaces own accept/reject rules.
 */

/** Minimal approved-registration facts supplied from the host transaction. */
export const BOOKING_TRANSPORT_CAPACITY_REJECTED = "BOOKING_TRANSPORT_CAPACITY_REJECTED";

export type BookingApprovedCapacitySnapshot = {
  readonly partySize: number;
  /** Sanitized, opaque intake snapshot; hosts should include only capacity inputs. */
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
};

/** Capacity facts for a cancellation that may remove seats offered by a registrant. */
export type BookingCapacityReleasePolicyContext = {
  /** Current lifecycle status, supplied by the host from the locked row. */
  readonly bookingStatus: string;
  /** Capacity-only snapshot for the booking being removed. */
  readonly booking: BookingApprovedCapacitySnapshot;
  /** Approved capacity snapshots excluding `booking`, re-read under the same tour lock. */
  readonly approvedCapacitySnapshots: readonly BookingApprovedCapacitySnapshot[];
};

export type BookingCapacityReleaseDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reasonCode: string };

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
  /** Approved registration facts, read under the same tour lock as occupancy. */
  readonly approvedCapacitySnapshots?: readonly BookingApprovedCapacitySnapshot[];
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
  /** Decide whether a locked cancellation may release its transport capacity. */
  evaluateCapacityRelease(ctx: BookingCapacityReleasePolicyContext): BookingCapacityReleaseDecision;
};

/** Registration marker for public-booking capability — gated on public create path. */
export type BookingPublicCapabilityPort = {
  readonly kind: string;
  /** True when this workspace allows public guest create. */
  supportsPublicCreate(): boolean;
};
