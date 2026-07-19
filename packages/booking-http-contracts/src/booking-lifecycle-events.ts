/**
 * Booking lifecycle outbox event types.
 *
 * Booking emits domain facts via outbox. Host owns durable relay / notification delivery.
 * Reject is intentionally silent (no outbox row).
 */
import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "./booking-event-reaction.port";

export { BOOKING_APPROVE_OUTBOX_EVENT_TYPE };

/** Waitlist transition outbox event — emitted by Booking on pending → waitlisted. */
export const BOOKING_WAITLIST_OUTBOX_EVENT_TYPE = "registration.waitlisted" as const;

/** Cancel transition outbox event — emitted by Booking on cancel. */
export const BOOKING_CANCEL_OUTBOX_EVENT_TYPE = "registration.cancelled" as const;
