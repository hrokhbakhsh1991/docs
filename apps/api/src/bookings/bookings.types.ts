export type BookingStatus =
  | "pending"
  | "approved"
  | "waitlisted"
  | "rejected"
  | "cancelled";

export type BookingPaymentStatus = "unpaid" | "partial" | "paid";

export type BookingTourChip = {
  readonly tourId: string;
  readonly tourTitle: string;
  readonly pendingCount: number;
  readonly totalCount: number;
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

export type BookingsListView = "ops" | "mine";

export type BookingsListQuery = {
  readonly view: BookingsListView;
  readonly status?: BookingStatus;
  readonly tourId?: string;
  readonly paymentStatus?: BookingPaymentStatus;
  readonly q?: string;
  readonly cursor?: string;
  readonly limit: number;
};

export type BookingListItem = {
  readonly id: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly partySize: number;
  readonly status: BookingStatus;
  readonly paymentStatus: BookingPaymentStatus;
  readonly departureAt: string;
  readonly submittedAt: string;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
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
  readonly tourChips: readonly BookingTourChip[];
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
};

export type RejectBookingRequest = {
  readonly reason?: string;
};

export type RejectBookingResponse = {
  readonly id: string;
  readonly status: BookingStatus;
};
