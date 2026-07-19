/**
 * NEGATIVE FIXTURE — intentional Booking application boundary breach (Phase B1.9).
 * Must NOT be imported by production application sources.
 * Scoped `guard-booking-boundary --scan-file` must FAIL on this file.
 */
import type { Prisma } from "@prisma/client";

/** Keeps the Prisma import as a real type dependency for the boundary guard. */
export type IllegalBookingPrismaTx = Prisma.TransactionClient;
