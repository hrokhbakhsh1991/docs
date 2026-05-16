import { Injectable } from "@nestjs/common";
import { LoggerService } from "../logger/logger.service";
import type { DomainEvent } from "./domain-event.interface";
import type { EventHandler } from "./event-handler.interface";
import type { EventPublisher } from "./event-publisher.interface";

/**
 * **Development / single-process only** — handlers run in-process after `publish` resolves.
 * Events are **not** persisted: process crash = lost events. No cross-replica fan-out.
 *
 * **Production:** use a **transactional outbox** table written in the same DB transaction as domain
 * mutations, plus a relay worker pushing to Kafka/Rabbit/SNS (or equivalent). Replace this
 * registration with an outbox-backed `EventPublisher` while keeping the same port shape.
 *
 * Error policy: each handler runs in isolation; failures are logged and **never** reject `publish`
 * or throw into the caller (no crash propagation).
 */
@Injectable()
export class InMemoryEventBus implements EventPublisher {
  private readonly handlersByType = new Map<string, Set<EventHandler>>();

  constructor(private readonly logger: LoggerService) {}

  register(handler: EventHandler): void {
    for (const t of handler.handledEventTypes) {
      let set = this.handlersByType.get(t);
      if (!set) {
        set = new Set();
        this.handlersByType.set(t, set);
      }
      set.add(handler);
    }
  }

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    const set = this.handlersByType.get(event.eventType);
    if (!set || set.size === 0) {
      return;
    }
    for (const handler of set) {
      void this.dispatchSafely(handler, event as DomainEvent<unknown>);
    }
  }

  private dispatchSafely(handler: EventHandler, event: DomainEvent<unknown>): void {
    queueMicrotask(() => {
      void (async () => {
        try {
          await handler.handle(event);
        } catch (error: unknown) {
          const name = handler.constructor?.name ?? "EventHandler";
          this.logger.error("domain_event_handler_failed", {
            event_id: event.eventId,
            event_type: event.eventType,
            handler: name,
            error_name: error instanceof Error ? error.name : typeof error,
            error_message: error instanceof Error ? error.message : String(error)
          });
        }
      })();
    });
  }
}
