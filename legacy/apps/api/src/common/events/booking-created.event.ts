import type { DomainEvent } from "./domain-event.interface";

/** Stable event name for registration / booking placement (v1 payload). */
export const BOOKING_CREATED_EVENT_TYPE = "booking.created" as const;

export const BOOKING_CREATED_SCHEMA_VERSION = 1 as const;

export type BookingCreatedPayload = {
  registrationId: string;
  tourId: string;
};

/** Deterministic id for at-most-one `booking.created` outbox row per registration (enqueue dedupe). */
export function stableBookingCreatedDomainEventId(registrationId: string): string {
  return `${BOOKING_CREATED_EVENT_TYPE}:${registrationId}`;
}

/**
 * Builds a v1 `booking.created` envelope. `tenantId` / `correlationId` should come from request context when available.
 * `eventId` defaults to {@link stableBookingCreatedDomainEventId} so duplicate enqueue is idempotent.
 */
export function createBookingCreatedEvent(input: {
  tenantId: string;
  correlationId: string | null;
  payload: BookingCreatedPayload;
  /** Override only for tests; production should use the stable default. */
  eventId?: string;
}): DomainEvent<BookingCreatedPayload> {
  return {
    eventId: input.eventId ?? stableBookingCreatedDomainEventId(input.payload.registrationId),
    eventType: BOOKING_CREATED_EVENT_TYPE,
    occurredAt: new Date().toISOString(),
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    schemaVersion: BOOKING_CREATED_SCHEMA_VERSION,
    payload: input.payload
  };
}
