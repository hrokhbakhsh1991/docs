/**
 * Denali booking status vocabulary — derives from shared booking contract (CW4-03).
 * @see packages/booking-http-contracts/src/booking-lifecycle-transitions.ts
 * @see src/bookings/ops-manifest.ts statusPipeline
 */

import {
  BOOKING_STATUS_PIPELINE,
  BOOKING_TERMINAL_STATUSES,
  type BookingStatus,
} from "@app-tour/booking-http-contracts";

export type DenaliBookingStatus = BookingStatus;

/** Derived from `BOOKING_STATUS_PIPELINE` — same order as ops manifest. */
export const DENALI_BOOKING_STATUS_PIPELINE = BOOKING_STATUS_PIPELINE;

export const DENALI_BOOKING_TERMINAL_STATUSES = BOOKING_TERMINAL_STATUSES;

export function isDenaliBookingStatus(value: unknown): value is DenaliBookingStatus {
  return (
    typeof value === "string" &&
    (DENALI_BOOKING_STATUS_PIPELINE as readonly string[]).includes(value)
  );
}

export function isDenaliBookingTerminalStatus(status: DenaliBookingStatus): boolean {
  return (DENALI_BOOKING_TERMINAL_STATUSES as readonly string[]).includes(status);
}
