# Domain events (foundation)

Lightweight **abstraction only** — no Kafka/RabbitMQ in this repo.

## Pieces

| File | Role |
|------|------|
| `domain-event-envelope.ts` | Shared envelope: `eventId`, `eventType`, `occurredAt`, `tenantId`, `correlationId`, `schemaVersion`, `payload` |
| `domain-event.interface.ts` | `DomainEvent<TPayload>` alias |
| `event-publisher.interface.ts` | `EventPublisher.publish` port |
| `event-handler.interface.ts` | `EventHandler` with `handledEventTypes` + `handle(event: DomainEvent<unknown>)` |
| `in-memory-event-bus.ts` | Dev-safe bus: async dispatch, per-handler try/catch, no throw to publisher |
| `event-tokens.ts` | `EVENT_PUBLISHER` DI token |
| `booking-created.event.ts` | Sample `booking.created` v1 factory |
| `audit-booking-created.handler.ts` | Sample handler (structured log) |
| `events.module.ts` | Registers bus + sample handler subscription |

## Rules

- **Handlers** are Nest providers; wire them in `EventsModule` (or feature modules), **not** in controllers.
- **Publishers** call `EventPublisher` from **domain/application services** after successful work (often after DB commit when not using outbox).

## Limitations (current bus)

- In-memory only; **no durability** and **no multi-replica** delivery.
- `publish` schedules handlers on microtasks; ordering across event types is not guaranteed.

## Production direction

1. Add an **outbox** table (`event_id`, payload JSON, `published_at`, …) written in the **same transaction** as the aggregate row.
2. Implement `EventPublisher` to insert outbox rows (or dual-write via repository).
3. Replace in-process dispatch with a **worker** that reads outbox, publishes to a broker, marks rows published.
4. Keep `EventHandler` as consumer-side interfaces in worker(s) or as idempotent subscribers.
