/**
 * Denali booking status vocabulary — aligned with ops pipeline + HTTP contracts.
 * @see packages/booking-http-contracts/src/booking-status.ts
 * @see src/bookings/ops-manifest.ts statusPipeline
 */

import type { BookingStatus } from "@app-cloud/booking-http-contracts";

export type DenaliBookingStatus = BookingStatus;

/** Same order as `denaliRegistrationOpsManifest.statusPipeline`. */
export const DENALI_BOOKING_STATUS_PIPELINE = Object.freeze([
  "pending",
  "approved",
  "waitlisted",
  "rejected",
  "cancelled",
] as const satisfies readonly DenaliBookingStatus[]);

export const DENALI_BOOKING_TERMINAL_STATUSES = Object.freeze([
  "rejected",
  "cancelled",
] as const satisfies readonly DenaliBookingStatus[]);

export function isDenaliBookingStatus(value: unknown): value is DenaliBookingStatus {
  return (
    typeof value === "string" &&
    (DENALI_BOOKING_STATUS_PIPELINE as readonly string[]).includes(value)
  );
}

export function isDenaliBookingTerminalStatus(status: DenaliBookingStatus): boolean {
  return (DENALI_BOOKING_TERMINAL_STATUSES as readonly string[]).includes(status);
}
