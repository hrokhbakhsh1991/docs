import type {
  BookingListPageInput,
  BookingListPageOutput,
  BookingPaymentStatus,
  BookingRecord,
  CreateBookingRequest,
} from "../bookings.types";

/**
 * Booking persistence port (Phase B0.4) — Finance `FinanceRepositoryPort` mirror.
 * SoT for the repository contract. Adapters: Prisma + InMemory.
 *
 * @remarks Compatibility alias {@link BookingsRepository} preserves existing imports.
 */
export type BookingGuestDuplicateMatch =
  | { readonly kind: "user"; readonly value: string }
  | { readonly kind: "label"; readonly value: string }
  | { readonly kind: "email"; readonly value: string }
  | { readonly kind: "nationalId"; readonly value: string }
  | { readonly kind: "phone"; readonly value: string };

export type BookingsSummaryStats = {
  readonly pending: number;
  readonly approvedToday: number;
  readonly departures7d: number;
  readonly waitlist: number;
  readonly tourChips: readonly {
    readonly tourId: string;
    readonly tourTitle: string;
    readonly pendingCount: number;
    readonly totalCount: number;
  }[];
};

export interface BookingRepositoryPort {
  /** @deprecated Test/perf baseline only — delegates to listByTenantPage (cap 500). Never use for product correctness. */
  listByTenant(tenantId: string): Promise<BookingRecord[]>;
  listByTenantPage(input: BookingListPageInput): Promise<BookingListPageOutput>;
  /** Exact COUNT for the same filters as {@link listByTenantPage} (no row cap). */
  countByTenantFilters(
    input: Omit<BookingListPageInput, "limit" | "cursor">
  ): Promise<number>;
  /**
   * Active guest duplicate on a tour (not cancelled/rejected). Uncapped SQL/filter lookup.
   * @see docs/phase-20/p7/appendices/BOOKING_LIST_CORRECTNESS.md
   */
  findActiveGuestDuplicate(input: {
    readonly tenantId: string;
    readonly tourId: string;
    readonly match: BookingGuestDuplicateMatch;
  }): Promise<BookingRecord | null>;
  /** Ops summary KPIs — SQL aggregates; not a capped list scan. */
  getBookingsSummaryStats(input: {
    readonly tenantId: string;
    readonly now: Date;
    /** Default ops — P4a filter; all = include pure-history tours (P4c). */
    readonly tourChipScope?: "ops" | "all";
  }): Promise<BookingsSummaryStats>;
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
  /**
   * Merge keys into `registrationIntake` (finance obligation override, etc.).
   * Missing booking → null.
   */
  mergeRegistrationIntake(input: {
    readonly bookingId: string;
    readonly tenantId: string;
    readonly patch: Readonly<Record<string, unknown>>;
  }): Promise<BookingRecord | null>;
  /**
   * Update guest projection columns + merge intake in one write (reclassify other→self).
   * Missing booking → null.
   */
  updateGuestProjectionAndIntake(input: {
    readonly bookingId: string;
    readonly tenantId: string;
    readonly guestLabel: string;
    readonly guestEmail?: string | null;
    readonly guestPhone?: string | null;
    readonly intakePatch: Readonly<Record<string, unknown>>;
  }): Promise<BookingRecord | null>;
  /**
   * Owned other→self reclassify in one tenant TX: JSON-path gate + intake merge.
   * Returns minimal `{ id, status }` on success; null when gate fails or row missing.
   */
  reclassifyOwnedOtherToSelf(input: {
    readonly bookingId: string;
    readonly tenantId: string;
    readonly submittedByUserId: string;
    readonly guestLabel: string;
    readonly guestEmail?: string | null;
    readonly guestPhone?: string | null;
    readonly intakePatch: Readonly<Record<string, unknown>>;
  }): Promise<{ readonly id: string; readonly status: string } | null>;
  /**
   * Create pending in one tenant TX: tour advisory lock → re-sum approved → optional
   * capacity assert → INSERT. Soft gate vs approved occupancy (pending does not consume seats).
   */
  createBooking(input: {
    tenantId: string;
    submittedByUserId: string;
    body: CreateBookingRequest;
    assertCapacityInTx?: (ctx: {
      readonly tourId: string;
      readonly partySize: number;
      readonly occupiedApprovedPartySize: number;
    }) => void;
  }): Promise<BookingRecord>;
  /**
   * Approve in one tenant TX: load → occupancy sum → optional capacity assert → status + outbox.
   * {@link assertCapacityInTx} runs inside the TX after occupancy is re-read (fail-closed).
   */
  approveWithOutbox(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
    correlationId?: string;
    assertCapacityInTx?: (ctx: {
      readonly booking: BookingRecord;
      readonly occupiedApprovedPartySize: number;
    }) => void | Promise<void>;
  }): Promise<BookingRecord>;
  bulkApproveWithOutbox(input: {
    ids: readonly string[];
    tenantId: string;
    outboxEvent: string;
    maxBatch: number;
    assertCapacityInTx?: (ctx: {
      readonly booking: BookingRecord;
      readonly occupiedApprovedPartySize: number;
    }) => void | Promise<void>;
  }): Promise<BookingRecord[]>;
  /**
   * pending|waitlisted → rejected. Persist status + optional rejectReason — **no outbox** (decision B).
   * Intentionally silent; do not compare with cancel observability.
   * @see docs/phase-20/p7/appendices/BOOKING_REJECT_LIFECYCLE_OWNERSHIP.md
   */
  rejectBooking(input: {
    bookingId: string;
    tenantId: string;
    reason?: string;
  }): Promise<BookingRecord>;
  /**
   * pending → waitlisted in one tenant TX + outbox (`registration.waitlisted`).
   */
  waitlistBooking(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
  }): Promise<BookingRecord>;
  /**
   * pending|waitlisted|approved → cancelled in one tenant TX + outbox (`registration.cancelled`).
   * Takes the same tour advisory lock as approve (occupancy-safe vs concurrent approve).
   * Terminal sources (rejected|cancelled) → BookingStatusConflictError.
   */
  cancelBooking(input: {
    bookingId: string;
    tenantId: string;
    outboxEvent: string;
  }): Promise<BookingRecord>;
  seedBooking(record: BookingRecord): void;
}

/** @deprecated Prefer {@link BookingRepositoryPort}. Kept for existing import paths. */
export type BookingsRepository = BookingRepositoryPort;
