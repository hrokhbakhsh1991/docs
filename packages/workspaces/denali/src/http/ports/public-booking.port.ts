export type DenaliPublicBookingCreateInput = {
  readonly tenantId: string;
  readonly guestUserId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly guestEmail: string;
  readonly guestPhone?: string;
  readonly partySize: number;
  readonly departureAt: string;
};

export type DenaliPublicBookingCreateResult = {
  readonly id: string;
  readonly status: string;
};

/** Host-injected bookings adapter — Prisma/memory lives in apps/api. */
export interface DenaliPublicBookingPort {
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
