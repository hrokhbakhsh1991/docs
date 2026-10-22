/**
 * Workspace booking create policies — executable ports (not registration tokens).
 * Host supplies occupancy; workspaces own accept/reject rules.
 */

/** Context for validation + capacity at public create time. */
export type BookingCapacityTransportFact = {
  /** Approved party size represented by this booking. */
  readonly partySize: number;
  /** Opaque workspace-selected transport key; the host does not interpret it. */
  readonly transportKind: string | null;
  /** Optional passenger-seat offer attached to the selected transport. */
  readonly offeredPassengerSeats: number | null;
};

/** Project only capacity-relevant scalars from persisted registration intake. */
export function toBookingCapacityTransportFact(input: {
  readonly partySize: number;
  readonly registrationIntake: unknown;
}): BookingCapacityTransportFact {
  const intake =
    input.registrationIntake !== null &&
    typeof input.registrationIntake === "object" &&
    !Array.isArray(input.registrationIntake)
      ? (input.registrationIntake as Readonly<Record<string, unknown>>)
      : null;
  const transport = intake?.transport;
  const transportRecord =
    typeof transport === "object" && transport !== null && !Array.isArray(transport)
      ? (transport as Readonly<Record<string, unknown>>)
      : null;
  const rawKind = transportRecord?.kind;
  const transportKind =
    rawKind === "primary" ||
    rawKind === "personal_car" ||
    rawKind === "no_car_dong" ||
    rawKind === "no_car_acquaintance"
      ? rawKind
      : null;
  const rawSeats = transportRecord?.personalCarOccupants;
  const offeredPassengerSeats =
    rawSeats === 0 || rawSeats === 1 || rawSeats === 2 || rawSeats === 3 ? rawSeats : null;

  return {
    partySize: Math.max(0, Math.trunc(input.partySize)),
    transportKind,
    offeredPassengerSeats,
  };
}

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
  /** Minimal approved transport facts; excludes names/contact/profile data. */
  readonly approvedTransportFacts?: readonly BookingCapacityTransportFact[];
  /**
   * Tour capacity ceiling when known.
   * `null` = unknown — Denali treats as unlimited; workspaces may still apply markers.
   */
  readonly tourCapacityMax: number | null;
};

/** Capacity facts for a cancellation that may remove seats offered by a registrant. */
export type BookingCapacityReleasePolicyContext = {
  /** Current lifecycle status, supplied by the host from the locked row. */
  readonly bookingStatus: string;
  /** Capacity-only facts for the booking being removed. */
  readonly booking: BookingCapacityTransportFact;
  /** Approved capacity-only facts for this tour, re-read under its capacity lock. */
  readonly approvedTransportFacts: readonly BookingCapacityTransportFact[];
};

export type BookingCapacityReleaseDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reasonCode: string };

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
