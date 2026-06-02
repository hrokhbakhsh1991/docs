import { Global, Inject, Injectable, Module, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "../../config/config.service";
import { LoggerModule } from "../logger/logger.module";
import { AuditBookingCreatedHandler } from "./audit-booking-created.handler";
import { InMemoryEventBus } from "./in-memory-event-bus";
import { NoOpEventPublisher } from "./noop-event-publisher";
import { EVENT_PUBLISHER } from "./event-tokens";
import type { EventPublisher } from "./event-publisher.interface";

@Injectable()
class EventsModuleInit implements OnModuleInit {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(InMemoryEventBus) private readonly bus: InMemoryEventBus,
    @Inject(AuditBookingCreatedHandler)
    private readonly auditBookingCreated: AuditBookingCreatedHandler
  ) {}

  onModuleInit(): void {
    if (this.config.getEnableInMemoryDomainEvents()) {
      this.bus.register(this.auditBookingCreated);
    }
  }
}

/**
 * Domain event infrastructure. **Production:** {@link EVENT_PUBLISHER} defaults to {@link NoOpEventPublisher};
 * critical flows emit via {@link OutboxService} in the same DB transaction. Opt-in
 * `ENABLE_IN_MEMORY_DOMAIN_EVENTS=true` wires the in-memory bus for local debugging only.
 */
@Global()
@Module({
  imports: [LoggerModule],
  providers: [
    InMemoryEventBus,
    AuditBookingCreatedHandler,
    NoOpEventPublisher,
    EventsModuleInit,
    {
      provide: EVENT_PUBLISHER,
      useFactory: (
        config: ConfigService,
        inMemory: InMemoryEventBus,
        noop: NoOpEventPublisher
      ): EventPublisher => (config.getEnableInMemoryDomainEvents() ? inMemory : noop),
      inject: [ConfigService, InMemoryEventBus, NoOpEventPublisher]
    }
  ],
  exports: [InMemoryEventBus, AuditBookingCreatedHandler, EVENT_PUBLISHER, NoOpEventPublisher]
})
export class EventsModule {}
