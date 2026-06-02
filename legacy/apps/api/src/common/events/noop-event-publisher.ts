import { Injectable } from "@nestjs/common";
import type { DomainEvent } from "./domain-event.interface";
import type { EventPublisher } from "./event-publisher.interface";

/**
 * Production default for {@link EVENT_PUBLISHER}: no in-process dispatch.
 * Critical domain notifications must be written via {@link OutboxService} in the same DB transaction.
 */
@Injectable()
export class NoOpEventPublisher implements EventPublisher {
  async publish<TPayload>(_event: DomainEvent<TPayload>): Promise<void> {
    return;
  }
}
