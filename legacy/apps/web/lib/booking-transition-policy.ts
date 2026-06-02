/**
 * Single source of truth for booking (= registration aggregate) transitions.
 *
 * Mirrors backend:
 * - `validateStatusTransition` / `RegistrationStatus` — `registration.entity.ts`
 * - `validatePaymentTransition` / `RegistrationPaymentStatus` — same entity + `registrations.service.ts`
 *
 * PSP row lifecycle (`payment.entity.ts` / `payments.service.ts`) is separate from this aggregate policy.
 */

import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";

/** Persisted aggregate payment status (`registration.entity.ts`). Alias kept for call-site clarity. */
export type BookingAggregatePaymentStatus = RegistrationPaymentStatus;

/** Allowed *next* booking statuses (excludes implicit same-state no-op). */
export const BOOKING_STATUS_TRANSITIONS: Record<RegistrationStatus, RegistrationStatus[]> = {
  Pending: ["Accepted", "AcceptedPaid", "Rejected", "Cancelled"],
  Accepted: ["AcceptedPaid", "Rejected", "Cancelled", "NoShow"],
  AcceptedPaid: ["Rejected", "Cancelled", "Refunded"],
  Rejected: [],
  Cancelled: [],
  NoShow: [],
  Refunded: [],
};

/** Allowed *next* aggregate payment statuses (excludes implicit same-state no-op). */
export const PAYMENT_TRANSITIONS: Record<BookingAggregatePaymentStatus, BookingAggregatePaymentStatus[]> = {
  NotPaid: ["Paid", "Failed"],
  Paid: ["Refunded"],
  Failed: ["NotPaid", "Paid"],
  Partial: [],
  Refunded: [],
};

export const TERMINAL_BOOKING_STATES: readonly RegistrationStatus[] = [
  "Rejected",
  "Cancelled",
  "NoShow",
  "Refunded",
] as const;

export const TERMINAL_PAYMENT_STATES: readonly BookingAggregatePaymentStatus[] = ["Partial", "Refunded"] as const;

export function getAllowedBookingTransitions(
  status: RegistrationStatus,
): readonly RegistrationStatus[] {
  if (isTerminalBookingState(status)) {
    return [];
  }
  return BOOKING_STATUS_TRANSITIONS[status] ?? [];
}

/**
 * Allowed aggregate payment transitions from `paymentStatus`.
 * Global rule: when `registrationStatus` is `Cancelled` or `Rejected`, backend rejects all payment updates — returns `[]`.
 * When `registrationStatus` is omitted, that gate is skipped (only use when no registration context exists).
 */
export function getAllowedPaymentTransitions(
  paymentStatus: BookingAggregatePaymentStatus,
  registrationStatus?: RegistrationStatus,
): readonly BookingAggregatePaymentStatus[] {
  if (registrationStatus === "Cancelled" || registrationStatus === "Rejected") {
    return [];
  }
  if (isTerminalPaymentState(paymentStatus)) {
    return [];
  }
  return PAYMENT_TRANSITIONS[paymentStatus] ?? [];
}

export function isTerminalBookingState(status: RegistrationStatus): boolean {
  return (TERMINAL_BOOKING_STATES as readonly RegistrationStatus[]).includes(status);
}

export function isTerminalPaymentState(status: BookingAggregatePaymentStatus): boolean {
  return (TERMINAL_PAYMENT_STATES as readonly BookingAggregatePaymentStatus[]).includes(status);
}
