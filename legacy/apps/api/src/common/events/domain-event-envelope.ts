/**
 * Canonical wire shape for domain events (API-internal today; future outbox / message broker payloads).
 *
 * **Production:** prefer **transactional outbox** — write the envelope in the same DB transaction as the
 * aggregate change, then a relay publishes to Kafka/Rabbit/SNS. This avoids lost events and double
 * publishes if the process crashes after commit.
 *
 * **Dispatch:** transactional outbox (`outbox_events`) for critical flows; optional
 * `ENABLE_IN_MEMORY_DOMAIN_EVENTS=true` enables {@link InMemoryEventBus} for local-only handlers.
 */
export type DomainEventEnvelope<TPayload = unknown> = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  tenantId: string | null;
  correlationId: string | null;
  schemaVersion: number;
  payload: TPayload;
};
