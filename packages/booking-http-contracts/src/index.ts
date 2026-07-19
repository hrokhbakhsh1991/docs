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
  CancelBookingResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  RejectBookingRequest,
  RejectBookingResponse,
  WaitlistBookingResponse,
} from "./booking-http-types";

export {
  isBookingJsonReceiptContentType,
  parseBookingMemberReceiptJsonBody,
  parseBookingsListQuery,
  parseBulkApproveBookingsBody,
  parseCreateBookingBody,
  parseRejectBookingBody,
  readBookingNumberField,
  readBookingRegistrationIntake,
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

export {
  BOOKING_APPROVE_OUTBOX_DELIVERY,
  BOOKING_APPROVE_REACTION_DELIVERY,
  type BookingApproveOutboxDelivery,
  type BookingApproveReactionDelivery,
} from "./booking-approve-delivery";

export {
  BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
  BOOKING_WAITLIST_OUTBOX_EVENT_TYPE,
} from "./booking-lifecycle-events";

export {
  BOOKING_POLICY_CASE_A_GUEST_LABEL,
  type BookingCapacityPolicyPort,
  type BookingCreatePolicyContext,
  type BookingPublicCapabilityPort,
  type BookingValidationPolicyPort,
} from "./booking-create-policy.port";

export {
  BOOKING_CAPACITY_MAX_REQUIRED_MESSAGE,
  assertBookingBaseCreateShape,
  assertBookingStandardCapacity,
  readTourCapacityMaxFromIntake,
} from "./booking-create-policy.rules";
