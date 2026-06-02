import type { DomainEventEnvelope } from "./domain-event-envelope";

/** Strongly-typed domain event instance (envelope + payload). */
export type DomainEvent<TPayload = unknown> = DomainEventEnvelope<TPayload>;
