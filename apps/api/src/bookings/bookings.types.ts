/**
 * Booking domain / persistence types (apps/api).
 * HTTP wire DTOs SoT: `@app-tour/booking-http-contracts` (Phase B1.2).
 */
import type {
  BookingPaymentStatus,
  BookingStatus,
  CreateBookingRequest as BookingHttpCreateBookingRequest,
} from "@app-tour/booking-http-contracts";

export type {
  ApproveBookingResponse,
  BookingListItem,
  BookingPaymentStatus,
  BookingStatus,
  BookingTourChip,
  BookingsListQuery,
  BookingsListResponse,
  BookingsListView,
  BookingsSummaryQuery,
  BookingsSummaryResponse,
  BulkApproveBookingsRequest,
  BulkApproveBookingsResponse,
  CancelBookingResponse,
  CreateBookingResponse,
  RejectBookingRequest,
  RejectBookingResponse,
  WaitlistBookingResponse,
} from "@app-tour/booking-http-contracts";

export type CreateBookingRequest = BookingHttpCreateBookingRequest & {
  readonly memberUserId?: string;
};

export type BookingRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly guestEmail: string | null;
  readonly guestPhone: string | null;
  readonly partySize: number;
  readonly status: BookingStatus;
  readonly paymentStatus: BookingPaymentStatus;
  readonly departureAt: string;
  readonly submittedAt: string;
  readonly submittedByUserId: string;
  readonly approvedAt: string | null;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
  /**
   * List projection scalar — set when intake is stripped but target must remain
   * on the HTTP list item (BK-SAFE-01). Detail may omit and derive from intake.
   */
  readonly registrantTarget?: "self" | "other";
  /**
   * List projection scalars for transport roster (H5-T3) — derived from intake JSON.
   */
  readonly transportKind?:
    | "primary"
    | "personal_car"
    | "no_car_dong"
    | "no_car_acquaintance"
    | null;
  readonly personalCarOccupants?: 1 | 2 | 3 | null;
  /** Ops reject reason when status=rejected; omitted when unset (BC). */
  readonly rejectReason?: string;
};

export type BookingOutboxRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly domainEventId: string;
  readonly createdAt: string;
};

export type BookingListPageInput = {
  readonly tenantId: string;
  readonly submittedByUserId?: string;
  readonly status?: BookingStatus;
  /** Multi-status IN filter (UX-BKG-43a); takes precedence over `status`. */
  readonly statuses?: readonly BookingStatus[];
  readonly tourId?: string;
  readonly paymentStatus?: BookingPaymentStatus;
  readonly q?: string;
  /** Inclusive lower bound (ISO) for departureAt filter. */
  readonly departureFrom?: string;
  /** Exclusive upper bound (ISO) for departureAt filter. */
  readonly departureTo?: string;
  /** Inclusive lower bound (ISO) for approvedAt filter (UX-BKG-43b). */
  readonly approvedFrom?: string;
  /** Exclusive upper bound (ISO) for approvedAt filter. */
  readonly approvedTo?: string;
  /** Keyset order — default submittedAt (BOOKINGS-OPS-UX P3b-a). */
  readonly sort?: "submittedAt" | "departureAt";
  readonly cursor?: string;
  readonly limit: number;
};

export type BookingListPageOutput = {
  readonly items: readonly BookingRecord[];
  readonly nextCursor: string | null;
};
