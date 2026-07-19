import type {
  ActiveDuplicateByEmailInput,
  ActiveDuplicateByGuestLabelInput,
  ActiveDuplicateByNationalIdInput,
  ActiveDuplicateByUserInput,
  BookingListPageInput,
  BookingListPageOutput,
  BookingOutboxRecord,
  BookingPaymentStatus,
  BookingRecord,
  BookingTourChip,
  BookingsSummaryCounts,
  CreateBookingRequest,
} from "../bookings.types";

/**
 * Booking persistence port (Phase B0.4) — Finance `FinanceRepositoryPort` mirror.
 * SoT for the repository contract. Adapters: Prisma + InMemory.
 *
 * @remarks Compatibility alias {@link BookingsRepository} preserves existing imports.
 */
export interface BookingRepositoryPort {
  /** @deprecated Test/perf baseline only — delegates to listByTenantPage (cap 500). */
  listByTenant(tenantId: string): Promise<BookingRecord[]>;
  listByTenantPage(input: BookingListPageInput): Promise<BookingListPageOutput>;
  listBySubmittedUser(tenantId: string, submittedByUserId: string): Promise<BookingRecord[]>;
  countBookingsBySubmittedUser(tenantId: string, submittedByUserId: string): Promise<number>;
  countCancelledBookingsBySubmittedUser(
    tenantId: string,
    submittedByUserId: string
  ): Promise<number>;
  countCompletedTripsBySubmittedUser(
    tenantId: string,
    submittedByUserId: string,
    now: Date
  ): Promise<number>;
  listRecentBySubmittedUser(
    tenantId: string,
    submittedByUserId: string,
    limit: number
  ): Promise<BookingRecord[]>;
  findActiveDuplicateByUser(input: ActiveDuplicateByUserInput): Promise<BookingRecord | null>;
  findActiveDuplicateByGuestLabel(
    input: ActiveDuplicateByGuestLabelInput
  ): Promise<BookingRecord | null>;
  findActiveDuplicateByEmail(input: ActiveDuplicateByEmailInput): Promise<BookingRecord | null>;
  findActiveDuplicateByNationalId(
    input: ActiveDuplicateByNationalIdInput
  ): Promise<BookingRecord | null>;
  countByListFilters(input: Omit<BookingListPageInput, "limit" | "cursor">): Promise<number>;
  getBookingsSummaryCounts(tenantId: string, now: Date): Promise<BookingsSummaryCounts>;
  listTourChipsByTenant(tenantId: string): Promise<readonly BookingTourChip[]>;
  sumApprovedPartySizeByTourIds(
    tenantId: string,
    tourIds: readonly string[]
  ): Promise<Readonly<Record<string, number>>>;
  getById(id: string, tenantId: string): Promise<BookingRecord | null>;
  /** Batch identity projection for finance lists — same tenant scope as getById. */
  getByIds(ids: readonly string[], tenantId: string): Promise<BookingRecord[]>;
  /**
   * Finance → bookings projection. Raises payment status only (unpaid→partial→paid);
   * never downgrades. Missing booking returns null without throwing.
   */
  updatePaymentStatus(input: {
    readonly bookingId: string;
    readonly tenantId: string;
    readonly paymentStatus: BookingPaymentStatus;
  }): Promise<BookingRecord | null>;
  listOutboxByAggregate(aggregateId: string): Promise<BookingOutboxRecord[]>;
  createBooking(input: {
    tenantId: string;
    submittedByUserId: string;
    body: CreateBookingRequest;
  }): Promise<BookingRecord>;
  approveWithOutbox(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
    correlationId?: string;
  }): Promise<BookingRecord>;
  bulkApproveWithOutbox(input: {
    ids: readonly string[];
    tenantId: string;
    outboxEvent: string;
    maxBatch: number;
  }): Promise<BookingRecord[]>;
  rejectBooking(input: {
    bookingId: string;
    tenantId: string;
    reason?: string;
  }): Promise<BookingRecord>;
  seedBooking(record: BookingRecord): void;
}

/** @deprecated Prefer {@link BookingRepositoryPort}. Kept for existing import paths. */
export type BookingsRepository = BookingRepositoryPort;
