/** Booking wire status / payment enums (HTTP + application shared). */

export type BookingStatus =
  | "pending"
  | "approved"
  | "waitlisted"
  | "rejected"
  | "cancelled";

export type BookingPaymentStatus = "unpaid" | "partial" | "paid";

export type BookingsListView = "ops" | "mine";

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  "pending",
  "approved",
  "waitlisted",
  "rejected",
  "cancelled",
];

export const BOOKING_PAYMENT_STATUSES: readonly BookingPaymentStatus[] = [
  "unpaid",
  "partial",
  "paid",
];
