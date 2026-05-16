import type { EntityManager } from "typeorm";
import {
  BOOKING_CREATED_EVENT_TYPE,
  createBookingCreatedEvent
} from "../../common/events/booking-created.event";
import type { OutboxService } from "../outbox/outbox.service";
import {
  BookingFinalizationPhase,
  bookingFinalizationOutboxEventType
} from "./domain/booking-finalization-pipeline";
import { RegistrationStatus, type RegistrationEntity } from "./registration.entity";
import type { WaitlistItemEntity } from "./waitlist-item.entity";

function nowIso(): string {
  return new Date().toISOString();
}

/** `booking.created` — same DB transaction as registration persistence (transactional outbox only). */
export async function emitBookingCreatedOutboxEvent(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  tenantId: string;
  registrationId: string;
  tourId: string;
  correlationId: string | null;
}): Promise<void> {
  const event = createBookingCreatedEvent({
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    payload: { registrationId: input.registrationId, tourId: input.tourId }
  });
  await input.outboxService.addEvent(input.manager, {
    tenantId: input.tenantId,
    aggregateType: "Registration",
    aggregateId: input.registrationId,
    eventType: BOOKING_CREATED_EVENT_TYPE,
    correlationId: input.correlationId ?? undefined,
    domainEventId: event.eventId,
    payload: {
      envelope: {
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        tenantId: event.tenantId,
        correlationId: event.correlationId,
        schemaVersion: event.schemaVersion,
        payload: event.payload
      }
    }
  });
}

/** Finance-tied pipeline steps after `booking.created` (step 1 is {@link emitBookingCreatedOutboxEvent}). */
export async function emitBookingFinalizationPipelineEvent(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  tenantId: string;
  registrationId: string;
  phase: BookingFinalizationPhase;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (input.phase === BookingFinalizationPhase.BOOKING_CREATED) {
    return;
  }
  const eventType = bookingFinalizationOutboxEventType(input.phase);
  await input.outboxService.addEvent(input.manager, {
    tenantId: input.tenantId,
    aggregateType: "Registration",
    aggregateId: input.registrationId,
    eventType,
    payload: {
      entityType: "booking",
      entityId: input.registrationId,
      phase: input.phase,
      timestamp: nowIso(),
      ...(input.metadata ? { metadata: input.metadata } : {})
    }
  });
}

export async function emitRegistrationCreatedEvent(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  registration: RegistrationEntity;
  actorId: string;
  paymentRequired: boolean;
}): Promise<void> {
  await input.outboxService.addEvent(input.manager, {
    tenantId: input.registration.tenantId,
    aggregateType: "Registration",
    aggregateId: input.registration.id,
    eventType: "registration.created",
    payload: {
      entityType: "registration",
      entityId: input.registration.id,
      actorId: input.actorId,
      tenantId: input.registration.tenantId,
      tourId: input.registration.tourId,
      status: input.registration.status,
      paymentRequired: input.paymentRequired,
      timestamp: nowIso()
    }
  });
}

export async function emitRegistrationStatusChangedEvent(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  registration: RegistrationEntity;
  actorId: string;
  previousStatus: RegistrationStatus;
  newStatus: RegistrationStatus;
  eventType: string;
  source?: string;
  waitlistItemId?: string;
}): Promise<void> {
  await input.outboxService.addEvent(input.manager, {
    tenantId: input.registration.tenantId,
    aggregateType: "Registration",
    aggregateId: input.registration.id,
    eventType: input.eventType,
    payload: {
      entityType: "registration",
      entityId: input.registration.id,
      actorId: input.actorId,
      metadata: {
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        tourId: input.registration.tourId,
        scheduleId: null,
        ...(input.source ? { source: input.source } : {}),
        ...(input.waitlistItemId ? { waitlistItemId: input.waitlistItemId } : {})
      },
      timestamp: nowIso()
    }
  });
}

export async function emitRegistrationPaymentUpdatedEvent(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  registration: RegistrationEntity;
  actorId: string;
  /** @deprecated Prefer `finance.ledger.double_entry_applied` outbox; kept for optional inline summaries. */
  ledgerFactsSummary?: Array<{
    id: string;
    journalId: string;
    account: string;
    side: string;
    amount_minor: string;
    correlationId: string;
    idempotencyKey: string;
  }>;
}): Promise<void> {
  await input.outboxService.addEvent(input.manager, {
    tenantId: input.registration.tenantId,
    aggregateType: "Registration",
    aggregateId: input.registration.id,
    eventType: "registration.payment_updated",
    payload: {
      entityType: "registration",
      entityId: input.registration.id,
      actorId: input.actorId,
      metadata: {
        paymentStatus: input.registration.paymentStatus,
        paidAmount: input.registration.paidAmount ?? null,
        ...(input.ledgerFactsSummary && input.ledgerFactsSummary.length > 0
          ? { ledgerFacts: input.ledgerFactsSummary }
          : {})
      },
      timestamp: nowIso()
    }
  });
}

export async function emitWaitlistConvertedAndAcceptedEvents(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  waitlistItem: WaitlistItemEntity;
  promotedRegistration: RegistrationEntity;
  actorId: string;
  reason?: string;
  source: "manual_waitlist_conversion" | "waitlist_promotion";
}): Promise<void> {
  await input.outboxService.addEvent(input.manager, {
    tenantId: input.waitlistItem.tenantId,
    aggregateType: "WaitlistItem",
    aggregateId: input.waitlistItem.id,
    eventType: "waitlist.converted",
    payload: {
      entityType: "waitlist_item",
      entityId: input.waitlistItem.id,
      actorId: input.actorId,
      promotedRegistrationId: input.promotedRegistration.id,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.source === "waitlist_promotion" ? { tourId: input.waitlistItem.tourId } : {}),
      timestamp: nowIso()
    }
  });
  await input.outboxService.addEvent(input.manager, {
    tenantId: input.promotedRegistration.tenantId,
    aggregateType: "Registration",
    aggregateId: input.promotedRegistration.id,
    eventType: "registration.accepted",
    payload: {
      entityType: "registration",
      entityId: input.promotedRegistration.id,
      actorId: input.actorId,
      metadata: {
        previousStatus: null,
        newStatus: RegistrationStatus.ACCEPTED,
        ...(input.source === "manual_waitlist_conversion"
          ? { source: "manual_waitlist_conversion", waitlistItemId: input.waitlistItem.id }
          : {
              tourId: input.promotedRegistration.tourId,
              scheduleId: null,
              source: "waitlist_promotion",
              waitlistItemId: input.waitlistItem.id
            })
      },
      timestamp: nowIso()
    }
  });
}

export async function emitWaitlistCancelledEvent(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  waitlistItem: WaitlistItemEntity;
  actorId: string;
}): Promise<void> {
  await input.outboxService.addEvent(input.manager, {
    tenantId: input.waitlistItem.tenantId,
    aggregateType: "WaitlistItem",
    aggregateId: input.waitlistItem.id,
    eventType: "waitlist.cancelled",
    payload: {
      entityType: "waitlist_item",
      entityId: input.waitlistItem.id,
      actorId: input.actorId,
      reason: input.waitlistItem.cancelReason ?? null,
      timestamp: nowIso()
    }
  });
}

export async function emitRegistrationWaitlistedEvent(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  waitlistItem: WaitlistItemEntity;
  actorId: string;
}): Promise<void> {
  await input.outboxService.addEvent(input.manager, {
    tenantId: input.waitlistItem.tenantId,
    aggregateType: "WaitlistItem",
    aggregateId: input.waitlistItem.id,
    eventType: "registration.waitlisted",
    payload: {
      entityType: "waitlist_item",
      entityId: input.waitlistItem.id,
      actorId: input.actorId,
      tourId: input.waitlistItem.tourId,
      timestamp: nowIso()
    }
  });
}

export async function emitPublicRegistrationAcceptedEvent(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  registration: RegistrationEntity;
  actorId: string;
}): Promise<void> {
  await input.outboxService.addEvent(input.manager, {
    tenantId: input.registration.tenantId,
    aggregateType: "Registration",
    aggregateId: input.registration.id,
    eventType: "registration.accepted",
    payload: {
      entityType: "registration",
      entityId: input.registration.id,
      actorId: input.actorId,
      metadata: {
        previousStatus: null,
        newStatus: RegistrationStatus.ACCEPTED,
        source: "public_registration"
      },
      timestamp: nowIso()
    }
  });
}

