/**
 * SDE-001 — shared domain event envelope and canonical event inventory.
 * @see docs/standards/shared-domain-event-contract.mdoc
 */

export const SHARED_DOMAIN_EVENT_SCHEMA_VERSION = 1 as const;

export type SharedDomainEventSchemaVersion = typeof SHARED_DOMAIN_EVENT_SCHEMA_VERSION;

/** Canonical versioned envelope for outbox, relay, notification, and integration consumers. */
export type SharedDomainEventEnvelope<TPayload = Readonly<Record<string, unknown>>> = {
  readonly eventId: string;
  readonly eventType: string;
  readonly schemaVersion: SharedDomainEventSchemaVersion;
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly occurredAt: string;
  readonly actorUserId?: string;
  readonly correlationId?: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: TPayload;
  readonly idempotencyKey: string;
};

export type SharedDomainEventInventoryEntry = {
  readonly canonicalEventType: string;
  readonly aggregateType: string;
  readonly description: string;
  readonly compatibilityAliases: readonly string[];
  readonly producerNote: string;
  readonly notificationConsumer: string;
};

/** Machine-readable inventory — initial business events for notification & integration. */
export const SHARED_DOMAIN_EVENT_INVENTORY: readonly SharedDomainEventInventoryEntry[] =
  Object.freeze([
    {
      canonicalEventType: "registration.approved",
      aggregateType: "registration",
      description: "Member registration approved by operator/system",
      compatibilityAliases: Object.freeze(["RegistrationApproved"]),
      producerNote: "Booking approve outbox (BOOKING_APPROVE_OUTBOX_EVENT_TYPE)",
      notificationConsumer: "dispatch-member-notification-from-outbox",
    },
    {
      canonicalEventType: "payment.confirmed",
      aggregateType: "payment",
      description: "Payment captured / receipt approved — booking payment satisfied",
      compatibilityAliases: Object.freeze(["finance.ledger.double_entry_applied"]),
      producerNote: "Finance approveManualReceiptAtomic → ledger capture outbox",
      notificationConsumer: "dispatch-member-notification-from-outbox",
    },
    {
      canonicalEventType: "attendance.marked",
      aggregateType: "registration",
      description: "Day-of attendance recorded for a registration",
      compatibilityAliases: Object.freeze(["attendance.verified"]),
      producerNote: "Planned DP-7; no durable producer yet",
      notificationConsumer: "dispatch-member-notification-from-outbox",
    },
    {
      canonicalEventType: "ticket.created",
      aggregateType: "ticket",
      description: "Support ticket opened",
      compatibilityAliases: Object.freeze([]),
      producerNote: "Ticketing createTicket → outbox",
      notificationConsumer: "dispatch-ticket-notification-from-outbox",
    },
    {
      canonicalEventType: "tour.schedule.changed",
      aggregateType: "tour",
      description: "Tour schedule or logistics mutation requiring member notice",
      compatibilityAliases: Object.freeze(["tour.mutation.notification_required"]),
      producerNote: "emit-tour-mutation-side-effects",
      notificationConsumer: "dispatch-tour-schedule-notification-from-outbox",
    },
    {
      canonicalEventType: "tour.execution.started",
      aggregateType: "tour_execution",
      description: "In-tour operations execution entered in_progress",
      compatibilityAliases: Object.freeze([]),
      producerNote: "ITO-001 transitionTourExecutionState",
      notificationConsumer: "dispatch-tour-execution-notification-from-outbox",
    },
    {
      canonicalEventType: "tour.execution.completed",
      aggregateType: "tour_execution",
      description: "In-tour operations execution completed",
      compatibilityAliases: Object.freeze([]),
      producerNote: "ITO-001 transitionTourExecutionState",
      notificationConsumer: "dispatch-tour-execution-notification-from-outbox",
    },
    {
      canonicalEventType: "tour.execution.change.notified",
      aggregateType: "tour_execution",
      description: "Day-of meeting schedule/location/leader change",
      compatibilityAliases: Object.freeze([]),
      producerNote: "ITO-001 applyExecutionChange",
      notificationConsumer: "dispatch-tour-execution-notification-from-outbox",
    },
  ]);

const ALIAS_TO_CANONICAL: Readonly<Record<string, string>> = Object.freeze(
  SHARED_DOMAIN_EVENT_INVENTORY.reduce<Record<string, string>>((acc, entry) => {
    acc[entry.canonicalEventType] = entry.canonicalEventType;
    for (const alias of entry.compatibilityAliases) {
      acc[alias] = entry.canonicalEventType;
    }
    return acc;
  }, {}),
);

/** Resolve raw producer/legacy event type to canonical dot-notation name. */
export function normalizeDomainEventType(rawEventType: string): string {
  const trimmed = rawEventType.trim();
  return ALIAS_TO_CANONICAL[trimmed] ?? trimmed;
}

export type OutboxRowEnvelopeInput = {
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly domainEventId: string;
  readonly correlationId?: string | null;
  readonly createdAt: Date | string;
  readonly payload: unknown;
};

function asRecord(payload: unknown): Readonly<Record<string, unknown>> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Readonly<Record<string, unknown>>;
  }
  return {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/** Build SDE-001 envelope from a published outbox row. */
export function toSharedDomainEventEnvelope(
  row: OutboxRowEnvelopeInput,
): SharedDomainEventEnvelope {
  const payload = asRecord(row.payload);
  const canonicalType = normalizeDomainEventType(row.eventType);
  const schemaVersionRaw = payload.schemaVersion;
  const schemaVersion =
    typeof schemaVersionRaw === "number" && schemaVersionRaw >= 1
      ? (schemaVersionRaw as SharedDomainEventSchemaVersion)
      : SHARED_DOMAIN_EVENT_SCHEMA_VERSION;

  return {
    eventId: row.domainEventId,
    eventType: canonicalType,
    schemaVersion,
    tenantId: row.tenantId,
    workspaceId: optionalString(payload.workspaceId),
    occurredAt: toIso(row.createdAt),
    actorUserId: optionalString(payload.actorUserId ?? payload.submittedByUserId),
    correlationId: optionalString(row.correlationId ?? undefined),
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    payload,
    idempotencyKey: row.domainEventId,
  };
}

/** Lookup inventory entry by canonical or alias event type. */
export function findSharedDomainEventInventoryEntry(
  eventType: string,
): SharedDomainEventInventoryEntry | undefined {
  const canonical = normalizeDomainEventType(eventType);
  return SHARED_DOMAIN_EVENT_INVENTORY.find((entry) => entry.canonicalEventType === canonical);
}
