import type {
  BookingPaymentStatus,
  BookingStatus,
  BookingsListView,
} from "./booking-status";

/** Tour chip on bookings summary (operator HTTP). */
export type BookingTourChip = {
  readonly tourId: string;
  readonly tourTitle: string;
  readonly pendingCount: number;
  readonly totalCount: number;
};

export type BookingsListSort = "submittedAt" | "departureAt";

export type BookingsListQuery = {
  readonly view: BookingsListView;
  /** Single-status filter (BC). Prefer `statuses` when multiple. */
  readonly status?: BookingStatus;
  /**
   * Multi-status `IN` filter (UX-BKG-43a). When set, takes precedence over `status`.
   * Wire: `?status=pending,waitlisted` (comma-separated, order-insensitive).
   */
  readonly statuses?: readonly BookingStatus[];
  readonly tourId?: string;
  readonly paymentStatus?: BookingPaymentStatus;
  readonly q?: string;
  readonly cursor?: string;
  readonly limit: number;
  /**
   * Ops convenience filter: departureAt in [now, now+N days) where N is 1..30.
   * Expanded server-side via clock; not a client-supplied absolute range.
   */
  readonly departureWithinDays?: number;
  /**
   * Ops convenience filter: approvedAt in a UTC calendar-day window ending at
   * tomorrow UTC midnight (N=1 matches summary approvedToday). Expanded server-side.
   */
  readonly approvedWithinDays?: number;
  /**
   * List keyset order (BOOKINGS-OPS-UX P3b-a). Default submittedAt.
   * departureAt = soonest first (ASC).
   */
  readonly sort?: BookingsListSort;
};

export type BookingCapacitySnapshot = {
  /** Σ partySize of approved registrations for this tour (tenant-scoped). */
  readonly occupied: number;
  /** Tour SoT capacityMax; null when tour missing or uncapped/invalid. */
  readonly max: number | null;
};

export type BookingRegistrantTarget = "self" | "other";

/** Guest intake transport kind — list scalar (H5-T3); not the intake blob. */
export type BookingTransportKind =
  | "primary"
  | "personal_car"
  | "no_car_dong"
  | "no_car_acquaintance";

export type BookingListItem = {
  readonly id: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  /** Additive ops contact — present when stored on the registration. */
  readonly guestEmail?: string;
  /** Additive ops contact — present when stored on the registration. */
  readonly guestPhone?: string;
  /**
   * Who the seat is for — scalar derived from intake (not the intake blob).
   * Always present on list/detail projections; defaults to `self` when unset.
   */
  readonly registrantTarget: BookingRegistrantTarget;
  /**
   * Intake transport kind — scalar derived from intake (H5-T3 / BK-SAFE-01).
   * Always present on list/detail; `null` when intake missing or kind unknown.
   */
  readonly transportKind: BookingTransportKind | null;
  /**
   * When `transportKind=personal_car`, optional occupants 1–3 (list scalar).
   */
  readonly personalCarOccupants: 1 | 2 | 3 | null;
  readonly partySize: number;
  readonly status: BookingStatus;
  readonly paymentStatus: BookingPaymentStatus;
  readonly departureAt: string;
  readonly submittedAt: string;
  /** Present after approve when the host persisted approvedAt. */
  readonly approvedAt?: string;
  /**
   * Guest intake JSON — **detail / getBooking only** (UX-BKG-50 amend).
   * Must be omitted from `listBookings` list projection (BK-SAFE-01).
   */
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
  /** Present when status=rejected and an ops reason was persisted (additive / optional). */
  readonly rejectReason?: string;
  /**
   * Ops capacity bar — enriched on listBookings from approved party sum + tour capacityMax.
   * Absent when enrichment skipped (empty page).
   */
  readonly capacitySnapshot?: BookingCapacitySnapshot;
  /** DP1 — Finance hold dueAt projection for ops/member parity (S17). */
  readonly paymentDueAt?: string;
  /** DP1 — cancel provenance when status=cancelled. */
  readonly cancelSource?: string | null;
};

export type BookingsListResponse = {
  readonly items: readonly BookingListItem[];
  readonly total: number;
  readonly nextCursor: string | null;
};

export type BookingsSummaryResponse = {
  readonly pending: number;
  readonly approvedToday: number;
  readonly departures7d: number;
  readonly waitlist: number;
  /**
   * Tour chips for ops chrome. Default membership is ops-scoped
   * Default scope is `ops`: tours with pendingCount > 0, waitlistedCount > 0,
   * or departureAt >= now (UX-BKG-28). Pass `tourChipScope=all` on
   * GET /bookings/summary to include pure-history tours (BOOKINGS-OPS-UX P4c).
   */
  readonly tourChips: readonly BookingTourChip[];
};

/** GET /bookings/summary query (P4c). */
export type BookingTourChipScope = "ops" | "all";

export type BookingsSummaryQuery = {
  readonly tourChipScope: BookingTourChipScope;
};

export type BulkApproveBookingsRequest = {
  readonly ids: readonly string[];
};

export type BulkApproveBookingsResponse = {
  readonly approvedIds: readonly string[];
  readonly skippedIds: readonly string[];
};

export type CreateBookingRequest = {
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly guestEmail?: string;
  readonly guestPhone?: string;
  /** Ops-assisted registration owner inside the same tenant. Ignored on public create. */
  readonly memberUserId?: string;
  readonly partySize: number;
  readonly departureAt: string;
  readonly paymentStatus?: BookingPaymentStatus;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
};

export type CreateBookingResponse = {
  readonly id: string;
  readonly status: BookingStatus;
};

export type ApproveBookingResponse = {
  readonly id: string;
  readonly status: BookingStatus;
  readonly approvedAt: string;
  /** DP1 — UTC payment deadline from Finance Payment Hold. */
  readonly paymentDueAt?: string;
  readonly holdStatus?: string;
  readonly commercialQuotePayableMinor?: string;
};

export type RejectBookingRequest = {
  /** Optional ops reject reason — persisted as `rejectReason` when non-empty after trim. */
  readonly reason?: string;
};

export type RejectBookingResponse = {
  readonly id: string;
  readonly status: BookingStatus;
  /** Echo of persisted reject reason when provided (additive / optional). */
  readonly rejectReason?: string;
};

export type WaitlistBookingResponse = {
  readonly id: string;
  readonly status: BookingStatus;
};

export type CancelBookingResponse = {
  readonly id: string;
  readonly status: BookingStatus;
};

/** Member receipt JSON body on POST /bookings/:id/receipts (fileKey path). */
export type BookingMemberReceiptJsonBody = {
  readonly fileKey: string;
  readonly note?: string;
};
