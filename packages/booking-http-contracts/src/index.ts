/**
 * Booking-owned HTTP wire contracts (Phase B1.2).
 * Handlers / auth / Prisma remain in apps/api.
 */
export {
  BOOKING_PAYMENT_STATUSES,
  BOOKING_STATUSES,
  type BookingPaymentStatus,
  type BookingStatus,
  type BookingsListView,
} from "./booking-status";

export type {
  ApproveBookingResponse,
  BookingListItem,
  BookingMemberReceiptJsonBody,
  BookingTourChip,
  BookingsListQuery,
  BookingsListResponse,
  BookingsSummaryResponse,
  BulkApproveBookingsRequest,
  BulkApproveBookingsResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  RejectBookingRequest,
  RejectBookingResponse,
} from "./booking-http-types";

export {
  parseBookingMemberReceiptJsonBody,
  parseBookingsListQuery,
  parseBulkApproveBookingsBody,
  parseCreateBookingBody,
  parseRejectBookingBody,
  readBookingNumberField,
  readBookingStringField,
} from "./booking-request.parsers";

export type {
  BookingPublicCreateInput,
  BookingPublicCreateResult,
  BookingPublicPort,
} from "./booking-public.port";

export {
  BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
  type BookingApproveReactionInput,
  type WorkspaceBookingEventReactionPort,
} from "./booking-event-reaction.port";
