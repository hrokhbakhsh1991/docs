export type DenaliPublicBookingCreateInput = {
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

export type DenaliPublicBookingCreateResult = {
  readonly id: string;
  readonly status: string;
};

/** Host-injected bookings adapter — Prisma/memory lives in apps/api. */
export interface DenaliPublicBookingPort {
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
  createPendingBooking(input: DenaliPublicBookingCreateInput): Promise<DenaliPublicBookingCreateResult>;
  /** Sum approved `partySize` per tour — public catalog occupancy (no PII). */
  sumApprovedPartySizeByTourIds(
    tenantId: string,
    tourIds: readonly string[]
  ): Promise<Readonly<Record<string, number>>>;
}
