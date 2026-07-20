/**
 * Booking domain / persistence types (apps/api).
 * HTTP wire DTOs SoT: `@app-tour/booking-http-contracts` (Phase B1.2).
 */
import type {
  BookingPaymentStatus,
  BookingStatus,
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
  BookingsSummaryResponse,
  BulkApproveBookingsRequest,
  BulkApproveBookingsResponse,
  CancelBookingResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  RejectBookingRequest,
  RejectBookingResponse,
  WaitlistBookingResponse,
} from "@app-tour/booking-http-contracts";

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
  readonly tourId?: string;
  readonly paymentStatus?: BookingPaymentStatus;
  readonly q?: string;
  readonly cursor?: string;
  readonly limit: number;
};

export type BookingListPageOutput = {
  readonly items: readonly BookingRecord[];
  readonly nextCursor: string | null;
};
