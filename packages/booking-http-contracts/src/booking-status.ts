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

/** DP-7 day-of attendance mark — separate from registration lifecycle status. */
export type BookingAttendanceStatus = "present" | "absent";

export const BOOKING_ATTENDANCE_STATUSES: readonly BookingAttendanceStatus[] = [
  "present",
  "absent",
];
