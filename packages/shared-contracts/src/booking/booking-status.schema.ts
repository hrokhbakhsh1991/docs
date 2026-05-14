import { z } from "zod";

/**
 * Domain booking lifecycle (aligns with `apps/api` `registrations/domain/booking-status.ts`).
 */
export const BookingStatusSchema = z.enum([
  "pending",
  "awaiting_payment",
  "confirmed",
  "cancelled",
  "refunded",
  "waitlisted"
]);

export type BookingStatus = z.infer<typeof BookingStatusSchema>;
