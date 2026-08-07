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

/** Host-injected bookings adapter — Prisma/memory lives in apps/api. */
export interface BookingPublicPort {
  findDuplicateByTourGuest(
    tenantId: string,
    tourId: string,
    guestUserId: string
  ): Promise<{ readonly id: string } | null>;
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
}
