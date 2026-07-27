/**
 * Denali consumes the host-owned BookingPublicPort (Phase B1.4).
 * SoT: `@app-cloud/booking-http-contracts` — no Denali-prefixed port name.
 */
export type {
  BookingPublicCreateInput,
  BookingPublicCreateResult,
  BookingPublicPort,
} from "@app-cloud/booking-http-contracts";

/** @deprecated Prefer `BookingPublicPort` — alias kept for existing Denali tests. */
export type { BookingPublicPort as DenaliPublicBookingPort } from "@app-cloud/booking-http-contracts";
