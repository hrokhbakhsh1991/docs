/**
 * Denali consumes the host-owned BookingPublicPort (Phase B1.4).
 * SoT: `@app-tour/booking-http-contracts` — no Denali-prefixed port name.
 */
export type {
  BookingPublicCreateInput,
  BookingPublicCreateResult,
  BookingPublicOwnedDetail,
  BookingPublicPort,
  BookingPublicSelfRegistration,
} from "@app-tour/booking-http-contracts";

/** @deprecated Prefer `BookingPublicPort` — alias kept for existing Denali tests. */
export type { BookingPublicPort as DenaliPublicBookingPort } from "@app-tour/booking-http-contracts";
