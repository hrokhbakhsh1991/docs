/**
 * Booking domain / persistence types (apps/api).
 * HTTP wire DTOs SoT: `@app-tour/booking-http-contracts` (Phase B1.2).
 */
import type {
  BookingListItem,
  BookingPaymentStatus,
  BookingStatus,
  BookingsSummaryResponse,
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
  CreateBookingRequest,
  CreateBookingResponse,
  RejectBookingRequest,
  RejectBookingResponse,
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
  readonly items: readonly BookingListItem[];
  readonly nextCursor: string | null;
};

export type ActiveDuplicateLookupInput = {
  readonly tenantId: string;
  readonly tourId: string;
};

export type ActiveDuplicateByUserInput = ActiveDuplicateLookupInput & {
  readonly submittedByUserId: string;
};

export type ActiveDuplicateByGuestLabelInput = ActiveDuplicateLookupInput & {
  readonly guestLabel: string;
};

export type ActiveDuplicateByEmailInput = ActiveDuplicateLookupInput & {
  readonly email: string;
};

export type ActiveDuplicateByNationalIdInput = ActiveDuplicateLookupInput & {
  readonly nationalId: string;
};

/** Counts-only slice for repository summary aggregation. */
export type BookingsSummaryCounts = Omit<BookingsSummaryResponse, "tourChips">;
