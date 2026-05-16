import type { DomainEvent } from "./domain-event.interface";

/**
 * Port for publishing domain events. Implementations may be in-memory (dev), outbox-backed (prod), etc.
 * Callers should publish **after** successful persistence (or from within the same transaction when using outbox).
 */
export interface EventPublisher {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
}
