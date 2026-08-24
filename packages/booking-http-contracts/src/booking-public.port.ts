/**
 * Host-facing public booking port — Booking owns duplicate / create-pending / occupancy.
 * Workspace (Denali) owns registration orchestration, validation, and capacity.
 * Phase B1.4 — neutral host contract (SoT for public create boundary).
 */

export type BookingPublicCreateInput = {
  readonly tenantId: string;
  readonly guestUserId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly guestEmail?: string;
  readonly guestPhone?: string;
  readonly partySize: number;
  readonly departureAt: string;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
};

export type BookingPublicCreateResult = {
  readonly id: string;
  readonly status: string;
};

export type BookingPublicAutoApproveInput = {
  readonly tenantId: string;
  readonly bookingId: string;
  /** Must match the booking submitter (public guest). */
  readonly actorUserId: string;
};

/** Active self-registration row (registrantTarget ≠ other). */
export type BookingPublicSelfRegistration = {
  readonly id: string;
  readonly status: string;
};

export type BookingPublicOwnedDetail = {
  readonly id: string;
  readonly status: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  /** Who the seat is for — derived from intake; defaults to self. */
  readonly registrantTarget: "self" | "other";
  readonly paymentStatus: string;
  readonly departureAt: string;
  readonly submittedAt: string;
  readonly partySize: number;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
  /** DP-1 / DP-4 — finance hold due instant when approved-unpaid. */
  readonly paymentDueAt?: string | null;
  /** DP-4 — cancel provenance when terminal. */
  readonly cancelSource?: string | null;
};

/** Host-injected bookings adapter — Prisma/memory lives in apps/api. */
export interface BookingPublicPort {
  /**
   * Active **self** registration for this submitter on the tour
   * (excludes `registrantTarget=other`).
   */
  findDuplicateByTourGuest(
    tenantId: string,
    tourId: string,
    guestUserId: string
  ): Promise<BookingPublicSelfRegistration | null>;
  findDuplicateByTourGuestLabel(
    tenantId: string,
    tourId: string,
    guestLabel: string
  ): Promise<{ readonly id: string } | null>;
  findDuplicateByTourGuestNationalId(
    tenantId: string,
    tourId: string,
    nationalId: string
  ): Promise<{ readonly id: string } | null>;
  findDuplicateByTourGuestPhone(
    tenantId: string,
    tourId: string,
    phone: string
  ): Promise<{ readonly id: string } | null>;
  findDuplicateByTourEmail(
    tenantId: string,
    tourId: string,
    email: string
  ): Promise<{ readonly id: string } | null>;
  createPendingBooking(input: BookingPublicCreateInput): Promise<BookingPublicCreateResult>;
  /**
   * Tour-policy auto-approve after public create (no ops CASL).
   * Capacity failure → leave pending and return current status.
   */
  autoApprovePublicBooking(
    input: BookingPublicAutoApproveInput
  ): Promise<BookingPublicCreateResult>;
  /** Sum approved `partySize` per tour — public catalog occupancy (no PII). */
  sumApprovedPartySizeByTourIds(
    tenantId: string,
    tourIds: readonly string[]
  ): Promise<Readonly<Record<string, number>>>;
  /** Member-owned booking detail (submitter match) — for for-tour / amend. */
  findOwnedBooking(
    tenantId: string,
    bookingId: string,
    guestUserId: string
  ): Promise<BookingPublicOwnedDetail | null>;
  /**
   * Merge allowlisted intake keys when the actor owns the row.
   * Caller enforces status gate before invoke.
   */
  mergeOwnedRegistrationIntake(input: {
    readonly tenantId: string;
    readonly bookingId: string;
    readonly guestUserId: string;
    readonly patch: Readonly<Record<string, unknown>>;
  }): Promise<BookingPublicOwnedDetail | null>;
  /**
   * Promote an owned active `other` registration to `self` (same row id).
   * Used when member POSTs self and guest-identity uniques collide with their own other seat.
   * Returns null when missing / not owned / not active other / already has a different self.
   */
  reclassifyOwnedOtherToSelf(input: {
    readonly tenantId: string;
    readonly bookingId: string;
    readonly guestUserId: string;
    readonly guestLabel: string;
    readonly guestEmail?: string;
    readonly guestPhone?: string;
    readonly registrationIntakePatch: Readonly<Record<string, unknown>>;
  }): Promise<BookingPublicCreateResult | null>;
}
