import { Injectable } from "@nestjs/common";
import { LoggerService } from "../logger/logger.service";
import type { DomainEvent } from "./domain-event.interface";
import type { EventHandler } from "./event-handler.interface";
import { BOOKING_CREATED_EVENT_TYPE, type BookingCreatedPayload } from "./booking-created.event";

/**
 * Sample side-effect handler: structured log only. **Not** wired from controllers — registered on the
 * in-memory bus by {@link EventsModule}.
 *
 * Production: replace or supplement with outbox consumers (audit pipeline, analytics, etc.).
 */
@Injectable()
export class AuditBookingCreatedHandler implements EventHandler {
  readonly handledEventTypes = [BOOKING_CREATED_EVENT_TYPE] as const;

  constructor(private readonly logger: LoggerService) {}

  async handle(event: DomainEvent<unknown>): Promise<void> {
    const payload = event.payload as BookingCreatedPayload;
    this.logger.info("domain_event_booking_created_audit", {
      event_id: event.eventId,
      event_type: event.eventType,
      schema_version: event.schemaVersion,
      tenant_id: event.tenantId,
      correlation_id: event.correlationId,
      registration_id: payload.registrationId,
      tour_id: payload.tourId
    });
  }
}
