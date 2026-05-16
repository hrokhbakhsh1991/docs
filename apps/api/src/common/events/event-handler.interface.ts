import type { DomainEvent } from "./domain-event.interface";

/**
 * Subscribes to one or more `eventType` strings from {@link DomainEventEnvelope}.
 * Handlers must be idempotent where possible — at-least-once delivery is typical with brokers/outbox.
 */
export interface EventHandler {
  readonly handledEventTypes: readonly string[];
  handle(event: DomainEvent<unknown>): Promise<void>;
}
